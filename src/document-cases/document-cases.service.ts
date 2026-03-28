import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import {
  DocumentCase,
  FoundDocumentCaseStatus,
  LostDocumentCaseStatus,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
} from '../common/query-builder';
import { ExtractionProgressEvent } from '../extraction/extraction.interface';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentCasesCreateService } from './document-cases.create.service';
import {
  CreateFoundDocumentCaseDto,
  CreateLostDocumentCaseDto,
  QueryDocumentCaseDto,
  UpdateDocumentCaseDto,
} from './document-cases.dto';
import { DocumentCasesQueryService } from './document-cases.query.service';
import { DocumentCasesWorkflowService } from './documnt-cases.workflow.service';
import { HumanIdService } from '../human-id/human-id.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { EmbeddingService } from '../embedding/embedding.service';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LOST_CASE_EXTRACTION_QUEUE } from './document-cases.constants';
import { LostCaseExtractionJob } from './document-cases.interface';
import { ExtractionService } from '../extraction/extraction.service';

@Injectable()
export class DocumentCasesService {
  private readonly logger = new Logger(DocumentCasesService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
    private readonly embeddingService: EmbeddingService,
    private readonly documentCasesQueryService: DocumentCasesQueryService,
    private readonly documentCasesWorkflowService: DocumentCasesWorkflowService,
    private readonly documentCasesCreateService: DocumentCasesCreateService,
    private readonly humanIdService: HumanIdService,
    private readonly extractionService: ExtractionService,
    @InjectQueue(LOST_CASE_EXTRACTION_QUEUE)
    private readonly lostCaseExtractionQueue: Queue<LostCaseExtractionJob>,
  ) {}

  findAll(
    query: QueryDocumentCaseDto,
    user: UserSession['user'],
    originalUrl: string,
  ) {
    return this.documentCasesQueryService.findAll(query, user, originalUrl);
  }

  findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    return this.documentCasesQueryService.findOne(id, query, user);
  }

  private async canUpdateCase(caseId: string) {
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id: caseId },
      select: {
        lostDocumentCase: true,
        foundDocumentCase: true,
      },
    });
    if (!documentCase) {
      throw new NotFoundException('Document case not found');
    }
    if (
      documentCase.lostDocumentCase &&
      documentCase.lostDocumentCase.status === LostDocumentCaseStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Cant Update Lost Document Case that is completed',
      );
    }
    if (
      documentCase.foundDocumentCase &&
      documentCase.foundDocumentCase.status !== FoundDocumentCaseStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Cant Update Found Document Case that is not in draft status',
      );
    }
  }

  async update(
    id: string,
    updateDocumentCaseDto: UpdateDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    // const isAdmin = isSuperUser(user);
    await this.canUpdateCase(id);
    const docCase = await this.prismaService.documentCase.update({
      where: {
        id, // userId: isAdmin ? undefined : user.id
        userId: user.id,
      },
      data: {
        ...updateDocumentCaseDto,
        eventDate: updateDocumentCaseDto.eventDate
          ? dayjs(updateDocumentCaseDto.eventDate).toDate()
          : undefined,
      },
      include: {
        document: true,
      },
    });
    return await this.findOne(docCase.id, query, user);
  }

  reportFoundDocumentCase(
    extractionId: string,
    createDocumentCaseDto: CreateFoundDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
    onPublishProgressEvent?: (data: ExtractionProgressEvent) => void,
  ) {
    return this.documentCasesCreateService.reportFoundDocumentCase(
      extractionId,
      createDocumentCaseDto,
      query,
      user,
      onPublishProgressEvent,
    );
  }

  reportLostDocumentCaseScanned(
    extractionId: string,
    createDocumentCaseDto: CreateFoundDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
    onPublishProgressEvent?: (data: ExtractionProgressEvent) => void,
  ) {
    return this.documentCasesCreateService.reportLostDocumentCaseScanned(
      extractionId,
      createDocumentCaseDto,
      query,
      user,
      onPublishProgressEvent,
    );
  }

  private getName(givenNames?: string, surname?: string) {
    const givenName =
      givenNames?.split(' ').filter((name) => name.trim()) ?? [];
    const surName = surname?.trim() ?? '';
    const fullName = `${givenName.join(' ')} ${surName}`.trim();
    return {
      fullName: fullName ? fullName : null,
      givenName,
      surName: surName ? surName : null,
    };
  }

  async reportLostDocumentCase(
    createLostDocumentCaseDto: CreateLostDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const { images, ...dto } = createLostDocumentCaseDto;
    const { fullName, givenName, surName } = this.getName(
      dto.givenNames,
      dto.surname,
    );

    // Validate images before touching the DB — no AIExtraction record should be
    // created if the uploaded files are missing.
    if (images?.length) {
      await this.documentCasesCreateService.filesExists(images);
    }

    // Create an AIExtraction session upfront so the background job can link to it
    const extraction = images?.length
      ? await this.extractionService.getOrCreateAiExtraction()
      : null;

    const documentCase = await this.prismaService.documentCase.create({
      data: {
        userId: user.id,
        caseNumber: await this.humanIdService.generate({
          prefix: EntityPrefix.LOST_DOCUMENT_CASE,
        }),
        eventDate: dayjs(dto.eventDate).toDate(),
        addressId: dto.addressId,
        extractionId: extraction?.id,
        document: {
          create: {
            documentNumber: dto.documentNumber,
            fullName,
            givenNames: givenName,
            surname: surName,
            isExpired: dto.expiryDate
              ? dayjs(dto.expiryDate).isBefore(dayjs())
              : undefined,
            fingerprintPresent: dto.fingerprintPresent,
            photoPresent: dto.photoPresent,
            signaturePresent: dto.signaturePresent,
            typeId: dto.typeId,
            batchNumber: dto.batchNumber,
            serialNumber: dto.serialNumber,
            issuer: dto.issuer,
            issuanceDate: dto.issuanceDate
              ? dayjs(dto.issuanceDate).toDate()
              : undefined,
            expiryDate: dto.expiryDate
              ? dayjs(dto.expiryDate).toDate()
              : undefined,
            dateOfBirth: dto.dateOfBirth
              ? dayjs(dto.dateOfBirth).toDate()
              : undefined,
            placeOfBirth: dto.placeOfBirth,
            placeOfIssue: dto.placeOfIssue,
            gender: dto.gender,
            note: dto.note,
            addressRaw: dto.addressRaw,
            addressCountry: dto.addressCountry,
            addressComponents: dto.addressComponents,
            additionalFields: dto.additionalFields?.length
              ? {
                  createMany: {
                    skipDuplicates: true,
                    data: dto.additionalFields.map((field) => ({
                      fieldName: field.fieldName,
                      fieldValue: field.fieldValue,
                    })),
                  },
                }
              : undefined,
          },
        },
        description: dto.description,
        tags: dto.tags,
        lostDocumentCase: {
          create: {},
        },
      },
      include: {
        document: true,
      },
    });

    // If images were provided, dispatch background extraction — returns immediately
    if (images?.length && extraction && documentCase.document) {
      this.lostCaseExtractionQueue
        .add('extract-lost-case', {
          caseId: documentCase.id,
          documentId: documentCase.document.id,
          extractionId: extraction.id,
          images,
          userId: user.id,
        })
        .then((job) => {
          this.logger.debug(
            `Queued background extraction job ${job.id} for lost case ${documentCase.id}`,
          );
        })
        .catch((e) => {
          this.logger.error(
            `Failed to queue background extraction for lost case ${documentCase.id}`,
            e,
          );
        });
    }

    return await this.findOne(documentCase.id, query, user);
  }

  submitLostDocumentCase(
    lostCaseId: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    return this.documentCasesWorkflowService.submitLostCase(
      lostCaseId,
      query,
      user,
    );
  }
  submitFoundDocumentCase(
    foundCaseId: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    return this.documentCasesWorkflowService.submitFoundCase(
      foundCaseId,
      query,
      user,
    );
  }

  verifyFoundDocumentCase(
    foundCaseId: string,
    verifyDto: StatusTransitionReasonsDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    return this.documentCasesWorkflowService.verifyFoundCase(
      foundCaseId,
      verifyDto,
      query,
      user,
    );
  }

  rejectFoundDocumentCase(
    foundCaseId: string,
    rejectDto: StatusTransitionReasonsDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    return this.documentCasesWorkflowService.rejectFoundDocumentCase(
      foundCaseId,
      rejectDto,
      query,
      user,
    );
  }

  async remove(id: string, query: DeleteQueryDto, userId: string) {
    let data: DocumentCase;
    if (query?.purge) {
      data = await this.prismaService.documentCase.delete({
        where: { id, userId },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prismaService.documentCase.update({
        where: { id, userId },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return data;
  }

  async restore(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    const data = await this.prismaService.documentCase.update({
      where: { id, userId },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }
}

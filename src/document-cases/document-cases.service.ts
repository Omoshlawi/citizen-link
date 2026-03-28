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
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CASE_VISION_EXTRACTION_QUEUE } from './document-cases.constants';
import { CaseExtractionJob } from './document-cases.interface';

@Injectable()
export class DocumentCasesService {
  private readonly logger = new Logger(DocumentCasesService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
    private readonly documentCasesQueryService: DocumentCasesQueryService,
    private readonly documentCasesWorkflowService: DocumentCasesWorkflowService,
    private readonly documentCasesCreateService: DocumentCasesCreateService,
    private readonly humanIdService: HumanIdService,
    @InjectQueue(CASE_VISION_EXTRACTION_QUEUE)
    private readonly caseVisionExtractionQueue: Queue<CaseExtractionJob>,
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
    await this.canUpdateCase(id);
    const docCase = await this.prismaService.documentCase.update({
      where: {
        id,
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

  async reportFoundDocumentCase(
    createDocumentCaseDto: CreateFoundDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const {
      images,
      eventDate,
      typeId,
      submissionMethod,
      pickupStationId,
      collectionAddressId,
      scheduledPickupAt,
      ...caseData
    } = createDocumentCaseDto;

    // Validate images before touching the DB (for found cases, image/s will always be provided)
    await this.documentCasesCreateService.filesExists(images);

    // Create case + document first (document fields populated by extraction later)
    const caseNumber = await this.humanIdService.generate({
      prefix: EntityPrefix.FOUND_DOCUMENT_CASE,
    });

    const documentCase = await this.prismaService.documentCase.create({
      data: {
        ...caseData,
        caseNumber,
        eventDate: dayjs(eventDate).toDate(),
        userId: user.id,
        foundDocumentCase: {
          create: {
            submissionMethod,
            pickupStationId,
            collectionAddressId,
            scheduledPickupAt,
          },
        },
        document: {
          create: {
            typeId,
            images: images?.length
              ? {
                  createMany: {
                    data: images.map((image) => ({ url: image })),
                  },
                }
              : undefined,
          },
        },
        extraction: { create: {} },
      },
      include: { document: true, extraction: true },
    });

    // Create extraction record linked to this case, then queue the pipeline (document and and extraction are guaranted as they are created)
    this.caseVisionExtractionQueue
      .add('extract-vision', {
        caseId: documentCase.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        documentId: documentCase.document!.id!,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        extractionId: documentCase.extraction!.id,
        images,
        userId: user.id,
        caseType: 'FOUND',
        caseNumber,
      })
      .then((job) => {
        this.logger.debug(
          `Queued vision job ${job.id} for found case ${caseNumber}`,
        );
      })
      .catch((e) => {
        this.logger.error(
          `Failed to queue vision job for found case ${caseNumber}`,
          e,
        );
      });

    return await this.findOne(documentCase.id, query, user);
  }

  async reportLostDocumentCaseScanned(
    createDocumentCaseDto: CreateFoundDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const { images, eventDate, typeId, ...caseData } = createDocumentCaseDto;

    // Validate images before touching the DB (For auto the image is always their)
    await this.documentCasesCreateService.filesExists(images);

    const caseNumber = await this.humanIdService.generate({
      prefix: EntityPrefix.LOST_DOCUMENT_CASE,
    });
    // Create case + document first (document fields populated by extraction later)
    const documentCase = await this.prismaService.documentCase.create({
      data: {
        ...caseData,
        caseNumber,
        eventDate: dayjs(eventDate).toDate(),
        userId: user.id,
        lostDocumentCase: { create: { auto: true } },
        document: {
          create: {
            typeId,
            images: images?.length
              ? {
                  createMany: {
                    data: images.map((image) => ({ url: image })),
                  },
                }
              : undefined,
          },
        },
        extraction: { create: {} },
      },
      include: { document: true, extraction: true },
    });
    // Create extraction record linked to this case, then queue the pipeline

    this.caseVisionExtractionQueue
      .add('extract-vision', {
        caseId: documentCase.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        documentId: documentCase.document!.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        extractionId: documentCase.extraction!.id,
        images,
        userId: user.id,
        caseType: 'LOST',
        caseNumber,
      })
      .then((job) => {
        this.logger.debug(
          `Queued vision job ${job.id} for lost scan case ${caseNumber}`,
        );
      })
      .catch((e) => {
        this.logger.error(
          `Failed to queue vision job for lost scan case ${caseNumber}`,
          e,
        );
      });

    return await this.findOne(documentCase.id, query, user);
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

  async reportLostDocumentCaseMannual(
    createLostDocumentCaseDto: CreateLostDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const { fullName, givenName, surName } = this.getName(
      createLostDocumentCaseDto.givenNames,
      createLostDocumentCaseDto.surname,
    );

    return await this.prismaService.documentCase.create({
      data: {
        userId: user.id,
        caseNumber: await this.humanIdService.generate({
          prefix: EntityPrefix.LOST_DOCUMENT_CASE,
        }),
        eventDate: dayjs(createLostDocumentCaseDto.eventDate).toDate(),
        addressId: createLostDocumentCaseDto.addressId,
        document: {
          create: {
            documentNumber: createLostDocumentCaseDto.documentNumber,
            fullName,
            givenNames: givenName,
            surname: surName,
            isExpired: createLostDocumentCaseDto.expiryDate
              ? dayjs(createLostDocumentCaseDto.expiryDate).isBefore(dayjs())
              : undefined,
            fingerprintPresent: createLostDocumentCaseDto.fingerprintPresent,
            photoPresent: createLostDocumentCaseDto.photoPresent,
            signaturePresent: createLostDocumentCaseDto.signaturePresent,
            typeId: createLostDocumentCaseDto.typeId,
            batchNumber: createLostDocumentCaseDto.batchNumber,
            serialNumber: createLostDocumentCaseDto.serialNumber,
            issuer: createLostDocumentCaseDto.issuer,
            issuanceDate: createLostDocumentCaseDto.issuanceDate
              ? dayjs(createLostDocumentCaseDto.issuanceDate).toDate()
              : undefined,
            expiryDate: createLostDocumentCaseDto.expiryDate
              ? dayjs(createLostDocumentCaseDto.expiryDate).toDate()
              : undefined,
            dateOfBirth: createLostDocumentCaseDto.dateOfBirth
              ? dayjs(createLostDocumentCaseDto.dateOfBirth).toDate()
              : undefined,
            placeOfBirth: createLostDocumentCaseDto.placeOfBirth,
            placeOfIssue: createLostDocumentCaseDto.placeOfIssue,
            gender: createLostDocumentCaseDto.gender,
            note: createLostDocumentCaseDto.note,
            addressRaw: createLostDocumentCaseDto.addressRaw,
            addressCountry: createLostDocumentCaseDto.addressCountry,
            addressComponents: createLostDocumentCaseDto.addressComponents,
            additionalFields: createLostDocumentCaseDto.additionalFields?.length
              ? {
                  createMany: {
                    skipDuplicates: true,
                    data: createLostDocumentCaseDto.additionalFields.map(
                      (field) => ({
                        fieldName: field.fieldName,
                        fieldValue: field.fieldValue,
                      }),
                    ),
                  },
                }
              : undefined,
          },
        },
        description: createLostDocumentCaseDto.description,
        tags: createLostDocumentCaseDto.tags,
        lostDocumentCase: {
          create: { auto: false },
        },
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
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

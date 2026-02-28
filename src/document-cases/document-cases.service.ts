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
import { EmbeddingService } from '../ai/embeding.service';
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
    if (docCase.document?.id)
      await this.embeddingService.indexDocument(docCase.document.id);
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

  async reportLostDocumentCase(
    createLostDocumentCaseDto: CreateLostDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const documentCase = await this.prismaService.documentCase.create({
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
            fullName: createLostDocumentCaseDto.fullName,
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
          create: {},
        },
      },
      include: {
        document: true,
      },
    });
    return await this.findOne(documentCase.id, query, user);
  }

  submitDocumentCase(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    return this.documentCasesWorkflowService.submitDocumentCase(
      id,
      query,
      userId,
    );
  }

  verifyFoundDocumentCase(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    return this.documentCasesWorkflowService.verifyFoundDocumentCase(
      id,
      query,
      userId,
    );
  }

  rejectFoundDocumentCase(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    return this.documentCasesWorkflowService.rejectFoundDocumentCase(
      id,
      query,
      userId,
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

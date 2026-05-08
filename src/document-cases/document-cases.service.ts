import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import {
  DocumentCase,
  ExchangeDirection,
  ExchangeMethod,
  ExchangeStatus,
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
  UpdateFoundCaseSubmissionDto,
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
import { DocumentCasesTimelineService } from './document-cases.timeline.service';

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
    private readonly documentCaseTimelineService: DocumentCasesTimelineService,
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

  getCaseTimeline(id: string, user: UserSession['user']) {
    return this.documentCaseTimelineService.getCaseTimeline(id, user);
  }

  private async canUpdateCase(caseId: string) {
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id: caseId },
      select: {
        lostDocumentCase: true,
        foundDocumentCase: {
          include: {
            exchanges: {
              where: { status: ExchangeStatus.IN_PROGRESS },
              take: 1,
            },
          },
        },
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
        "Can't Update Lost Document Case that is completed",
      );
    }
    if (documentCase.foundDocumentCase) {
      if (
        documentCase.foundDocumentCase.status !== FoundDocumentCaseStatus.DRAFT
      ) {
        throw new BadRequestException(
          "Can't Update Found Document Case that is not in draft status",
        );
      }
      if (documentCase.foundDocumentCase.exchanges.length > 0) {
        throw new ConflictException(
          'Case is locked while a collection exchange is in progress. Cancel the exchange to edit.',
        );
      }
    }
    return documentCase;
  }

  async update(
    id: string,
    updateDocumentCaseDto: UpdateDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const documentCase = await this.canUpdateCase(id);
    const docCase = await this.prismaService.documentCase.update({
      where: {
        id,
        userId: user.id,
      },
      data: {
        eventDate: updateDocumentCaseDto.eventDate
          ? dayjs(updateDocumentCaseDto.eventDate).toDate()
          : undefined,
        addressId: updateDocumentCaseDto.addressId,
        description: updateDocumentCaseDto.description,
        tags: updateDocumentCaseDto.tags,
        foundDocumentCase: documentCase.foundDocumentCase
          ? { update: { where: { caseId: id }, data: {} } }
          : undefined,
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
      submissionStationId,
      submissionAddressId,
      submissionScheduledAt,
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
            // Create a SCHEDULED inbound exchange to record the finder's submission preference
            exchanges: {
              create: {
                exchangeNumber: await this.humanIdService.generate({
                  prefix: EntityPrefix.EXCHANGE,
                }),
                direction: ExchangeDirection.INBOUND,
                method: submissionMethod as ExchangeMethod,
                status: ExchangeStatus.SCHEDULED,
                stationId:
                  submissionMethod === ExchangeMethod.STATION_DROPOFF
                    ? submissionStationId
                    : null,
                addressId:
                  submissionMethod === ExchangeMethod.AGENT_PICKUP
                    ? submissionAddressId
                    : null,
                scheduledAt: submissionScheduledAt
                  ? new Date(submissionScheduledAt)
                  : new Date(),
                createdById: user.id,
              },
            },
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

    // Queue the extraction pipeline
    this.caseVisionExtractionQueue
      .add('extract-vision', {
        caseId: documentCase.id,
        documentId: documentCase.document!.id,
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

  async updateSubmissionPreference(
    foundCaseId: string,
    dto: UpdateFoundCaseSubmissionDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const foundCase = await this.prismaService.foundDocumentCase.findUnique({
      where: {
        id: foundCaseId,
        case: {
          userId: user.id,
        },
      },
      include: {
        exchanges: {
          where: {
            direction: ExchangeDirection.INBOUND,
            status: {
              in: [ExchangeStatus.SCHEDULED, ExchangeStatus.IN_PROGRESS],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!foundCase) throw new NotFoundException('Found Case not found');
    if (foundCase.status !== FoundDocumentCaseStatus.DRAFT) {
      throw new BadRequestException(
        'Submission preference can only be updated on DRAFT cases',
      );
    }

    const activeExchange = foundCase.exchanges[0];

    if (activeExchange?.status === ExchangeStatus.IN_PROGRESS) {
      throw new ConflictException(
        'Cannot update submission preference while a collection exchange is in progress',
      );
    }

    const stationId =
      dto.submissionMethod === ExchangeMethod.STATION_DROPOFF
        ? dto.submissionStationId
        : null;
    const addressId =
      dto.submissionMethod === ExchangeMethod.AGENT_PICKUP
        ? dto.submissionAddressId
        : null;
    const scheduledAt = dto.submissionScheduledAt;

    if (activeExchange) {
      await this.prismaService.documentExchange.update({
        where: { id: activeExchange.id },
        data: {
          method: dto.submissionMethod,
          stationId,
          addressId,
          ...(scheduledAt && { scheduledAt }),
        },
      });
    } else {
      const exchangeNumber = await this.humanIdService.generate({
        prefix: EntityPrefix.EXCHANGE,
      });
      await this.prismaService.documentExchange.create({
        data: {
          exchangeNumber,
          direction: ExchangeDirection.INBOUND,
          method: dto.submissionMethod,
          status: ExchangeStatus.SCHEDULED,
          foundCaseId: foundCase.id,
          stationId,
          addressId,
          scheduledAt: scheduledAt ?? new Date(),
          createdById: user.id,
        },
      });
    }

    return this.findOne(foundCase.caseId, query, user);
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

        documentId: documentCase.document!.id,

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

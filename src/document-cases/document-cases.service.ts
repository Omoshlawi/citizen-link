/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import { pick } from 'lodash';
import {
  ActorType,
  DocumentCase,
  FoundDocumentCaseStatus,
  LostDocumentCaseStatus,
} from '../../generated/prisma/client';
import { AiService } from '../ai/ai.service';
import { OcrService } from '../ai/ocr.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../query-builder';
import { S3Service } from '../s3/s3.service';
import {
  CreateFoundDocumentCaseDto,
  CreateLostDocumentCaseDto,
  QueryDocumentCaseDto,
  UpdateDocumentCaseDto,
} from './document-cases.dto';
import { CaseStatusTransitionsService } from '../case-status-transitions/case-status-transitions.service';

@Injectable()
export class DocumentCasesService {
  private readonly logger = new Logger(DocumentCasesService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly ocrService: OcrService,
    private readonly aiService: AiService,
    private readonly s3Service: S3Service,
    private readonly caseStatusTransitionsService: CaseStatusTransitionsService,
  ) {}

  private async filesExists(images: string[]): Promise<void> {
    this.logger.debug('Checking if images exist', images);
    const exists = await Promise.all(
      images.map((image) => this.s3Service.fileExists(image)),
    );
    const allExists = exists.every(Boolean);
    if (!allExists) {
      throw new BadRequestException('One or more images do not exist');
    }
    this.logger.debug('All images exist');
  }
  async reportFoundDocumentCase(
    createDocumentCaseDto: CreateFoundDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    const { eventDate, images, ...caseData } = createDocumentCaseDto;
    await this.filesExists(images);
    const extractionTasks = await Promise.all(
      images.map(async (image) => {
        const url = await this.s3Service.generateDownloadSignedUrl(image);
        const text = await this.ocrService.recognizeFromUrl(url);
        return text;
      }),
    );
    const info = await this.aiService.extractInformation(
      extractionTasks.join('\n\n'),
    );
    const { additionalFields, securityQuestions, ...documentpayload } = info;
    return await this.prismaService.documentCase.create({
      data: {
        ...caseData,
        eventDate: dayjs(eventDate).toDate(),
        foundDocumentCase: {
          create: {
            securityQuestion: securityQuestions,
          },
        },
        userId,
        document: {
          create: {
            ...documentpayload,
            expiryDate: documentpayload.expiryDate
              ? dayjs(documentpayload.expiryDate).toDate()
              : undefined,
            issuanceDate: documentpayload.issuanceDate
              ? dayjs(documentpayload.issuanceDate).toDate()
              : undefined,
            dateOfBirth: documentpayload.dateOfBirth
              ? dayjs(documentpayload.dateOfBirth).toDate()
              : undefined,
            images: images?.length
              ? {
                  createMany: {
                    data: images.map((image, i) => ({
                      url: image,
                      metadata: { ocrText: extractionTasks[i] },
                    })),
                  },
                }
              : undefined,
            additionalFields: additionalFields?.length
              ? {
                  createMany: {
                    data: additionalFields.map((field) => ({
                      fieldName: field.fieldName,
                      fieldValue: field.fieldValue,
                    })),
                  },
                }
              : undefined,
          },
        },
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async findAll(
    query: QueryDocumentCaseDto,
    userId: string,
    originalUrl: string,
  ) {
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.documentCase.findMany
    > = {
      where: {
        AND: [
          {
            voided: query?.includeVoided ? undefined : false,
            userId: query?.includeForOtherUsers ? undefined : userId, // only admin users can view all cases
            document: {
              typeId: query.documentType,
              serialNumber: query.documentNumber,
              issuer: { contains: query.documentIssuer },
              ownerName: { contains: query.ownerName },
              expiryDate: {
                gte: query.docuemtExpiryDateFrom
                  ? dayjs(query.docuemtExpiryDateFrom).toDate()
                  : undefined,
                lte: query.docuemtExpiryDateTo
                  ? dayjs(query.docuemtExpiryDateTo).toDate()
                  : undefined,
              },
              issuanceDate: {
                gte: query.docuemtIssueDateFrom
                  ? dayjs(query.docuemtIssueDateFrom).toDate()
                  : undefined,
                lte: query.docuemtIssueDateTo
                  ? dayjs(query.docuemtIssueDateTo).toDate()
                  : undefined,
              },
            },
            address: {
              level1: query.level1,
              level2: query.level2,
              level3: query.level3,
              level4: query.level4,
              level5: query.level5,
              country: query.country,
              postalCode: query.postalCode,
            },
            foundDocumentCase:
              query.caseType === 'FOUND' ? { isNot: null } : undefined,
            lostDocumentCase:
              query.caseType === 'LOST' ? { isNot: null } : undefined,
            eventDate: query.eventDateFrom
              ? {
                  gte: dayjs(query.eventDateFrom).toDate(),
                  lte: dayjs(query.eventDateTo).toDate(),
                }
              : undefined,
            createdAt: query.dateReportedFrom
              ? {
                  gte: dayjs(query.dateReportedFrom).toDate(),
                  lte: dayjs(query.dateReportedTo).toDate(),
                }
              : undefined,
          },
          {
            OR: query.search
              ? [
                  { document: { serialNumber: { contains: query?.search } } },
                  { description: { contains: query?.search } },
                  { document: { ownerName: { contains: query?.search } } },
                ]
              : undefined,
          },

          {
            address: {
              OR: query.location
                ? [
                    {
                      label: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      id: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      address1: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      address2: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      cityVillage: {
                        contains: query.location,
                        // mode: 'insensitive',
                      },
                    },
                    {
                      country: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      formatted: {
                        contains: query.location,
                        // mode: 'insensitive',
                      },
                    },
                    {
                      label: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      landmark: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      level1: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      level2: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      level3: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      level4: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      level5: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      plusCode: {
                        contains: query.location, //mode: 'insensitive'
                      },
                    },
                    {
                      postalCode: {
                        contains: query.location,
                        // mode: 'insensitive',
                      },
                    },
                  ]
                : undefined,
            },
          },
        ],
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.documentCase.findMany(dbQuery),
      this.prismaService.documentCase.count(pick(dbQuery, 'where')),
    ]);
    return {
      results: data,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  async findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    const data = await this.prismaService.documentCase.findUnique({
      where: { id, userId },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Document case not found');
    return data;
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
    userId: string,
  ) {
    await this.canUpdateCase(id);
    return await this.prismaService.documentCase.update({
      where: { id, userId },
      data: {
        ...updateDocumentCaseDto,
        eventDate: updateDocumentCaseDto.eventDate
          ? dayjs(updateDocumentCaseDto.eventDate).toDate()
          : undefined,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
  async reportLostDocumentCase(
    createLostDocumentCaseDto: CreateLostDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    return await this.prismaService.documentCase.create({
      data: {
        userId,
        eventDate: dayjs(createLostDocumentCaseDto.eventDate).toDate(),
        addressId: createLostDocumentCaseDto.addressId,
        document: {
          create: {
            ownerName: createLostDocumentCaseDto.ownerName,
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
            nationality: createLostDocumentCaseDto.nationality,
            note: createLostDocumentCaseDto.note,
            additionalFields: createLostDocumentCaseDto.additionalFields?.length
              ? {
                  createMany: {
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
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async submitFoundDocumentCase(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    // First, verify it's a found case owned by the user
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id, userId },
      include: {
        foundDocumentCase: true,
      },
    });

    if (!documentCase) {
      throw new NotFoundException('Document case not found');
    }

    if (!documentCase.foundDocumentCase) {
      throw new BadRequestException('This is not a found document case');
    }

    if (
      documentCase.foundDocumentCase.status !== FoundDocumentCaseStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot submit case. Current status: ${documentCase.foundDocumentCase.status}. Only DRAFT cases can be submitted.`,
      );
    }

    return await this.caseStatusTransitionsService.transitionStatus(
      id,
      FoundDocumentCaseStatus.SUBMITTED,
      ActorType.USER,
      userId,
      query?.v,
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

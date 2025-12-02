/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { pick } from 'lodash';
import { FunctionFirstArgument } from '../query-builder/query-builder.types';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationService } from '../query-builder/pagination.service';
import { CustomRepresentationQueryDto } from '../query-builder/query-builder.utils';
import { CustomRepresentationService } from '../query-builder/representation.service';
import { SortService } from '../query-builder/sort.service';
import {
  CreateDocumentImageDto,
  QueryDocumentImageDto,
} from './document-images.dto';
import { OcrService } from '../ai/ocr.service';
import { AiService } from '../ai/ai.service';
import { S3Service } from '../s3/s3.service';
import dayjs from 'dayjs';

@Injectable()
export class DocumentImagesService {
  private readonly logger = new Logger(DocumentImagesService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly ocrService: OcrService,
    private readonly aiService: AiService,
    private readonly s3Service: S3Service,
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

  private async ensureCaseTypeIsFound(caseId: string): Promise<void> {
    const caseData = await this.prismaService.documentCase.findUnique({
      where: { id: caseId },
      select: {
        foundDocumentCase: true,
      },
    });
    if (!caseData) throw new NotFoundException('Case not found');
    if (caseData?.foundDocumentCase === null) {
      throw new BadRequestException('Case is not a found case');
    }
  }

  async create(
    createDocumentImageDto: CreateDocumentImageDto,
    caseId: string,
    documentId: string,
    query: CustomRepresentationQueryDto,
  ) {
    await this.ensureCaseTypeIsFound(caseId);
    await this.filesExists(createDocumentImageDto.images);
    const extractionTasks = await Promise.all(
      createDocumentImageDto.images.map(async (image) => {
        const url = await this.s3Service.generateDownloadSignedUrl(image);
        const text = await this.ocrService.recognizeFromUrl(url);
        return text;
      }),
    );
    const info = await this.aiService.extractInformation(
      extractionTasks.join('\n\n'),
    );
    const { additionalFields, securityQuestions, typeId, ...documentpayload } =
      info;
    const updatedDocument = await this.prismaService.document.update({
      where: { id: documentId, caseId },
      data: {
        ...documentpayload,
        type: {
          connect: { id: typeId },
        },
        expiryDate: documentpayload.expiryDate
          ? dayjs(documentpayload.expiryDate).toDate()
          : undefined,
        issuanceDate: documentpayload.issuanceDate
          ? dayjs(documentpayload.issuanceDate).toDate()
          : undefined,
        dateOfBirth: documentpayload.dateOfBirth
          ? dayjs(documentpayload.dateOfBirth).toDate()
          : undefined,
        images: {
          deleteMany: {
            documentId,
          },
          createMany: {
            data: createDocumentImageDto.images.map((image, i) => ({
              url: image,
              metadata: { ocrText: extractionTasks[i] },
            })),
          },
        },
        additionalFields: additionalFields?.length
          ? {
              createMany: {
                skipDuplicates: true,
                data: additionalFields.map((field) => ({
                  fieldName: field.fieldName,
                  fieldValue: field.fieldValue,
                })),
              },
            }
          : undefined,
        case: {
          update: {
            foundDocumentCase: {
              update: {
                securityQuestion: securityQuestions,
              },
            },
          },
        } as any,
      },
      select: {
        images: {
          select: {
            id: true,
          },
        },
      },
    });
    return {
      images: await this.prismaService.image.findMany({
        where: {
          documentId,
          id: {
            in: updatedDocument.images.map((image) => image.id),
          },
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      }),
    };
  }

  async findAll(
    query: QueryDocumentImageDto,
    originalUrl: string,
    caseId: string,
    documentId: string,
  ) {
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.image.findMany
    > = {
      where: {
        documentId,
        document: { caseId },
        imageType: query?.imageType,
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.image.findMany(dbQuery),
      this.prismaService.image.count(pick(dbQuery, 'where')),
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
    caseId: string,
    documentId: string,
  ) {
    const data = await this.prismaService.image.findUnique({
      where: { id, documentId, document: { caseId } },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Image not found');
    return data;
  }
}

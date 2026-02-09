import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { AIInteractionType } from '../../generated/prisma/enums';
import { OcrService } from '../ai/ocr.service';
import { CustomRepresentationQueryDto } from '../common/query-builder';
import {
  DataExtractionDto,
  ImageAnalysisDto,
  SecurityQuestionsDto,
} from '../extraction/extraction.dto';
import { ProgressEvent } from '../extraction/extraction.interface';
import { ExtractionService } from '../extraction/extraction.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { CreateFoundDocumentCaseDto } from './document-cases.dto';
import { DocumentCasesQueryService } from './document-cases.query.service';

@Injectable()
export class DocumentCasesCreateService {
  private readonly logger = new Logger(DocumentCasesCreateService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly s3Service: S3Service,
    private readonly ocrService: OcrService,
    private readonly extractionService: ExtractionService,
    private readonly documentCasesQueryService: DocumentCasesQueryService,
  ) {}

  private async filesExists(
    images: string[],
    onFailed?: () => void,
  ): Promise<void> {
    this.logger.debug('Checking if images exist', images);
    const exists = await Promise.all(
      images.map((image) => this.s3Service.fileExists(image, 'tmp')),
    );
    const allExists = exists.every(Boolean);
    if (!allExists) {
      if (!onFailed)
        throw new BadRequestException('One or more images do not exist');
      else onFailed();
    }
    this.logger.debug('All images exist');
  }

  private moveAndGenerateBluredVersions(images: Array<string>, caseId: string) {
    return Promise.all(
      images.map(async (image) => {
        const caseImageKey = `${caseId}/${image}`;

        // Generate blured version and save to case bucket
        const buffer = await this.s3Service.downloadFile(image, 'tmp');
        const metadata = await this.s3Service.getFileMetadata(image, 'tmp');
        const mimeType =
          metadata?.ContentType ?? `image/${image.split('.').pop()}`;
        const bluredKey = `${caseId}/${this.s3Service.generateFileName(image)}`;
        const bluredBuffer = await this.ocrService.blueImage(buffer, 'strong');
        await this.s3Service.uploadFile(
          bluredKey,
          'cases',
          bluredBuffer,
          mimeType,
          {
            isBlurred: 'true',
            originalKey: caseImageKey,
          },
        );

        // Move file from tmp to cases
        await this.s3Service.moveFileToCasesBucket(image, caseId);
        return await this.prismaService.image.update({
          where: { document: { caseId }, url: image },
          data: {
            url: caseImageKey,
            blurredUrl: bluredKey,
          },
        });
      }),
    );
  }

  private async runAiExtraction(
    extractionId: string,
    images: string[],
    userId: string,
    skipSecurityQuestions = false,
    onPublishProgressEvent?: (data: ProgressEvent) => void,
  ) {
    onPublishProgressEvent?.({
      key: 'IMAGE_VALIDATION',
      state: { isLoading: true },
    });
    await this.filesExists(images, () => {
      onPublishProgressEvent?.({
        key: 'IMAGE_VALIDATION',
        state: {
          isLoading: false,
          error: new Error('One or more images do not exist'),
        },
      });
      throw new BadRequestException('One or more images do not exist');
    });
    onPublishProgressEvent?.({
      key: 'IMAGE_VALIDATION',
      state: {
        isLoading: false,
        data: 'Image validation succesfull',
      },
    });
    const _extractionTasks = await Promise.all(
      images.map(async (image) => {
        const buffer = await this.s3Service.downloadFile(image, 'tmp');
        const metadata = await this.s3Service.getFileMetadata(image, 'tmp');
        const mimeType =
          metadata?.ContentType ?? `image/${image.split('.').pop()}`;
        return { buffer, mimeType };
      }),
    );
    const extraction = await this.extractionService.extractInformation({
      extractionId,
      files: _extractionTasks,
      userId,
      options: {
        onPublishProgressEvent,
        skipSecurityQuestion: skipSecurityQuestions,
      },
    });
    const { additionalFields, ...documentpayload } =
      extraction.aiextractionInteractions.find(
        (interaction) =>
          interaction.aiInteraction.interactionType ===
          AIInteractionType.DATA_EXTRACTION,
      )?.extractionData as unknown as DataExtractionDto;
    const imageAnalysis = extraction.aiextractionInteractions.find(
      (interaction) =>
        interaction.aiInteraction.interactionType ===
        AIInteractionType.IMAGE_ANALYSIS,
    )?.extractionData as unknown as ImageAnalysisDto;
    const securityQuestions = extraction.aiextractionInteractions.find(
      (interaction) =>
        interaction.aiInteraction.interactionType ===
        AIInteractionType.SECURITY_QUESTIONS_GEN,
    )?.extractionData as unknown as SecurityQuestionsDto;

    return {
      extraction,
      securityQuestions,
      imageAnalysis,
      documentpayload,
      additionalFields,
    };
  }

  async reportFoundDocumentCase(
    extractionId: string,
    createDocumentCaseDto: CreateFoundDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    userId: string,
    onPublishProgressEvent?: (data: ProgressEvent) => void,
  ) {
    const { eventDate, images, ...caseData } = createDocumentCaseDto;
    const {
      extraction,
      securityQuestions,
      imageAnalysis,
      documentpayload,
      additionalFields,
    } = await this.runAiExtraction(
      extractionId,
      images,
      userId,
      false,
      onPublishProgressEvent,
    );
    const documentCase = await this.prismaService.documentCase.create({
      data: {
        ...caseData,
        extractionId: extraction.id,
        eventDate: dayjs(eventDate).toDate(),
        foundDocumentCase: {
          create: {
            securityQuestion: securityQuestions.questions,
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
                      metadata: {
                        // ocrText: extractionTasks[i]
                        imageAnalysis: imageAnalysis.images.find(
                          (imageAnalysis) => imageAnalysis.index === i,
                        ),
                      },
                    })),
                  },
                }
              : undefined,
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
          },
        },
      },
      include: {
        document: true,
      },
    });
    await this.moveAndGenerateBluredVersions(images, documentCase.id);
    return await this.documentCasesQueryService.findOne(
      documentCase.id,
      query,
      userId,
    );
  }

  async reportLostDocumentCaseScanned(
    extractionId: string,
    createDocumentCaseDto: CreateFoundDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    userId: string,
    onPublishProgressEvent?: (data: ProgressEvent) => void,
  ) {
    const { eventDate, images, ...caseData } = createDocumentCaseDto;
    const { extraction, imageAnalysis, documentpayload, additionalFields } =
      await this.runAiExtraction(
        extractionId,
        images,
        userId,
        true,
        onPublishProgressEvent,
      );
    const documentCase = await this.prismaService.documentCase.create({
      data: {
        ...caseData,
        extractionId: extraction.id,
        eventDate: dayjs(eventDate).toDate(),
        lostDocumentCase: {
          create: {},
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
                      metadata: {
                        // ocrText: extractionTasks[i]
                        imageAnalysis: imageAnalysis.images.find(
                          (imageAnalysis) => imageAnalysis.index === i,
                        ),
                      },
                    })),
                  },
                }
              : undefined,
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
          },
        },
      },
      include: {
        document: true,
      },
    });
    await this.moveAndGenerateBluredVersions(images, documentCase.id);
    return await this.documentCasesQueryService.findOne(
      documentCase.id,
      query,
      userId,
    );
  }
}

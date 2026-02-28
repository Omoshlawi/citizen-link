/* eslint-disable @typescript-eslint/no-unused-vars */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { EntityPrefix } from 'src/human-id/human-id.constants';
import {
  AIExtractionInteractionType,
  AIInteractionType,
} from '../../generated/prisma/enums';
import { OcrService } from '../ai/ocr.service';
import { UserSession } from '../auth/auth.types';
import { CustomRepresentationQueryDto } from '../common/query-builder';
import {
  SecurityQuestionsDto,
  TextExtractionOutputDto,
} from '../extraction/extraction.dto';
import {
  AsyncError,
  ExtractionAiProgressEvent,
  ExtractionProgressEvent,
} from '../extraction/extraction.interface';
import { ExtractionService } from '../extraction/extraction.service';
import { HumanIdService } from '../human-id/human-id.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { CreateFoundDocumentCaseDto } from './document-cases.dto';
import { DocumentCasesQueryService } from './document-cases.query.service';
import {
  AIExtraction,
  AIInteraction,
  AIExtractionInteraction,
} from '../../generated/prisma/client';
import { VisionService } from 'src/vision/vision.service';
import { VisionExtractionOutputDto } from '../vision/vision.dto';
import { parseDate } from '../app.utils';

@Injectable()
export class DocumentCasesCreateService {
  private readonly logger = new Logger(DocumentCasesCreateService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly s3Service: S3Service,
    private readonly ocrService: OcrService,
    private readonly extractionService: ExtractionService,
    private readonly documentCasesQueryService: DocumentCasesQueryService,
    private readonly humanIdService: HumanIdService,
    private readonly visionService: VisionService,
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
        return await this.prismaService.documentImage.update({
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
    user: UserSession['user'],
    onPublishProgressEvent?: (data: ExtractionProgressEvent) => void,
  ) {
    this.logger.debug('Running AI extraction for extractionId', extractionId);
    // Image validation ---
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
    const inputImages = await Promise.all(
      images.map(async (image) => {
        const buffer = await this.s3Service.downloadFile(image, 'tmp');
        const metadata = await this.s3Service.getFileMetadata(image, 'tmp');
        const mimeType =
          metadata?.ContentType ?? `image/${image.split('.').pop()}`;
        return { buffer, mimeType };
      }),
    );
    // Vision extraction
    onPublishProgressEvent?.({
      key: 'VISION_EXTRACTION',
      state: { isLoading: true },
    });
    const visionOutput =
      await this.visionService.extractTextFromImage(inputImages);
    await this.checkIfInteractionEncounteredError(
      extractionId,
      visionOutput,
      'VISION_EXTRACTION',
      onPublishProgressEvent,
    );

    // Text extraction
    onPublishProgressEvent?.({
      key: 'TEXT_EXTRACTION',
      state: { isLoading: true },
    });
    const textExtractionOutput =
      await this.extractionService.extractDocumentData(
        visionOutput.parsedResponse as unknown as VisionExtractionOutputDto,
        user,
      );
    await this.checkIfInteractionEncounteredError(
      extractionId,
      textExtractionOutput,
      'TEXT_EXTRACTION',
      onPublishProgressEvent,
    );

    const extractionResult =
      textExtractionOutput.parsedResponse as unknown as TextExtractionOutputDto;

    return await this.prismaService.aIExtraction.update({
      where: { id: extractionId },
      data: {
        // Quality summary — rolled up here, not recomputed elsewhere
        ocrConfidence: extractionResult.quality.ocrConfidence,
        extractionConfidence: extractionResult.quality.extractionConfidence,
        documentTypeCode: extractionResult.documentType.code,
        warnings: extractionResult.quality.warnings,
        success: true,
        aiextractionInteractions: {
          createMany: {
            skipDuplicates: true,
            data: [
              {
                extractionType: AIExtractionInteractionType.VISION_EXTRACTION,
                aiInteractionId: visionOutput.id,
                confidence: extractionResult.quality.ocrConfidence,
              },
              {
                extractionType: AIExtractionInteractionType.TEXT_EXTRACTION,
                aiInteractionId: textExtractionOutput.id,
                confidence: extractionResult.quality.extractionConfidence,
              },
            ],
          },
        },
      },
      include: {
        aiextractionInteractions: {
          include: {
            aiInteraction: true,
          },
        },
      },
    });
  }

  async checkIfInteractionEncounteredError(
    extractionId: string,
    interaction: AIInteraction,
    event: ExtractionAiProgressEvent['key'],
    onPublishProgressEvent?: (data: ExtractionAiProgressEvent) => void,
  ) {
    if (!interaction.parseError && !interaction.callError) {
      // ─── Happy path ──────────────────────────────────
      this.logger.debug(`AI extraction successful on ${event}`);
      onPublishProgressEvent?.({
        key: event,
        state: { isLoading: false, data: interaction },
      });
      return;
    }
    const errorPayload: AsyncError =
      (interaction.parseError as unknown as AsyncError) ??
      ({
        message: interaction.callError,
      } as AsyncError);

    // ─── Error path ────────────────────────────────────
    this.logger.error(
      `AI extraction encountered an error on ${event}`,
      JSON.stringify(errorPayload),
    );

    onPublishProgressEvent?.({
      key: event,
      state: { isLoading: false, error: errorPayload },
    });

    // Only TEXT_EXTRACTION carries quality fields we can roll up
    const extractionResult =
      event === 'TEXT_EXTRACTION'
        ? (interaction.parsedResponse as unknown as TextExtractionOutputDto)
        : null;

    // ─── Create the failed interaction record ──────────
    await this.prismaService.aIExtractionInteraction.create({
      data: {
        extractionType:
          event === 'VISION_EXTRACTION'
            ? AIExtractionInteractionType.VISION_EXTRACTION
            : AIExtractionInteractionType.TEXT_EXTRACTION,
        errorMessage: JSON.stringify(errorPayload),
        success: false,
        aiExtractionId: extractionId,
        aiInteractionId: interaction.id,
        // confidence omitted — step failed, no reliable value
      },
    });

    await this.prismaService.aIExtraction.update({
      where: { id: extractionId },
      data: {
        success: false,
        // Only populate quality fields if text extraction had partial results
        ...(extractionResult && {
          ocrConfidence: extractionResult.quality?.ocrConfidence,
          extractionConfidence: extractionResult.quality?.extractionConfidence,
          documentTypeCode: extractionResult.documentType?.code,
          warnings: extractionResult.quality?.warnings ?? [],
        }),
      },
    });

    throw new BadRequestException(errorPayload);
  }

  async reportFoundDocumentCase(
    extractionId: string,
    createDocumentCaseDto: CreateFoundDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
    onPublishProgressEvent?: (data: ExtractionProgressEvent) => void,
  ) {
    const { eventDate, images, ...caseData } = createDocumentCaseDto;
    const extraction = await this.runAiExtraction(
      extractionId,
      images,
      user,
      onPublishProgressEvent,
    );
    const documentData = extraction.aiextractionInteractions.find(
      (interaction) =>
        interaction.extractionType ===
        AIExtractionInteractionType.TEXT_EXTRACTION,
    )?.aiInteraction?.parsedResponse as unknown as TextExtractionOutputDto;
    const documentType = await this.prismaService.documentType.findUnique({
      where: {
        code: documentData.documentType.code,
      },
    });
    if (!documentType) {
      throw new BadRequestException('Document type not found');
    }
    const documentCase = await this.prismaService.documentCase.create({
      data: {
        ...caseData,
        caseNumber: await this.humanIdService.generate({
          prefix: EntityPrefix.FOUND_DOCUMENT_CASE,
        }),
        extractionId: extraction.id,
        eventDate: dayjs(eventDate).toDate(),
        userId: user.id,
        foundDocumentCase: {
          create: {},
        },
        document: {
          create: {
            fullName: documentData.person.fullName,
            documentNumber: documentData.document.number,
            typeId: documentType.id,
            gender: documentData.person.gender,
            expiryDate: parseDate(documentData.document.expiryDate),
            issuanceDate: parseDate(documentData.document.issueDate),
            dateOfBirth: parseDate(documentData.person.dateOfBirth),
            addressRaw: documentData.address.raw,
            addressComponents: documentData.address.components,
            addressCountry: documentData.address.country,
            placeOfBirth: documentData.person.placeOfBirth,
            placeOfIssue: documentData.document.placeOfIssue,
            issuer: documentData.document.issuer,
            serialNumber: documentData.document.serialNumber,
            batchNumber: documentData.document.batchNumber,
            fingerprintPresent: documentData.biometrics.fingerprintPresent,
            signaturePresent: documentData.biometrics.signaturePresent,
            photoPresent: documentData.biometrics.photoPresent,
            givenNames: documentData.person.givenNames,
            surname: documentData.person.surname,
            isExpired: documentData.document.expiryDate
              ? dayjs(documentData.document.expiryDate).isBefore(dayjs())
              : false,
            images: images?.length
              ? {
                  createMany: {
                    data: images.map((image) => ({
                      url: image,
                    })),
                  },
                }
              : undefined,
            additionalFields: documentData.additionalFields?.length
              ? {
                  createMany: {
                    skipDuplicates: true,
                    data: documentData.additionalFields.map((field) => ({
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
      user,
    );
  }

  async reportLostDocumentCaseScanned(
    extractionId: string,
    createDocumentCaseDto: CreateFoundDocumentCaseDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
    onPublishProgressEvent?: (data: ExtractionProgressEvent) => void,
  ) {
    const { eventDate, images, ...caseData } = createDocumentCaseDto;
    const extraction = await this.runAiExtraction(
      extractionId,
      images,
      user,
      onPublishProgressEvent,
    );
    const documentData = extraction.aiextractionInteractions.find(
      (interaction) =>
        interaction.extractionType ===
        AIExtractionInteractionType.TEXT_EXTRACTION,
    )?.aiInteraction?.parsedResponse as unknown as TextExtractionOutputDto;
    const documentType = await this.prismaService.documentType.findUnique({
      where: {
        code: documentData.documentType.code,
      },
    });
    if (!documentType) {
      throw new BadRequestException('Document type not found');
    }
    const documentCase = await this.prismaService.documentCase.create({
      data: {
        ...caseData,
        caseNumber: await this.humanIdService.generate({
          prefix: EntityPrefix.LOST_DOCUMENT_CASE,
        }),
        extractionId: extraction.id,
        eventDate: dayjs(eventDate).toDate(),
        lostDocumentCase: {
          create: {},
        },
        userId: user.id,
        document: {
          create: {
            fullName: documentData.person.fullName,
            documentNumber: documentData.document.number,
            typeId: documentType.id,
            gender: documentData.person.gender,
            expiryDate: parseDate(documentData.document.expiryDate),
            issuanceDate: parseDate(documentData.document.issueDate),
            dateOfBirth: parseDate(documentData.person.dateOfBirth),
            addressRaw: documentData.address.raw,
            addressComponents: documentData.address.components,
            addressCountry: documentData.address.country,
            placeOfBirth: documentData.person.placeOfBirth,
            placeOfIssue: documentData.document.placeOfIssue,
            issuer: documentData.document.issuer,
            serialNumber: documentData.document.serialNumber,
            batchNumber: documentData.document.batchNumber,
            fingerprintPresent: documentData.biometrics.fingerprintPresent,
            signaturePresent: documentData.biometrics.signaturePresent,
            photoPresent: documentData.biometrics.photoPresent,
            givenNames: documentData.person.givenNames,
            surname: documentData.person.surname,
            isExpired: documentData.document.expiryDate
              ? dayjs(documentData.document.expiryDate).isBefore(dayjs())
              : false,
            images: images?.length
              ? {
                  createMany: {
                    data: images.map((image) => ({
                      url: image,
                    })),
                  },
                }
              : undefined,
            additionalFields: documentData.additionalFields?.length
              ? {
                  createMany: {
                    skipDuplicates: true,
                    data: documentData.additionalFields.map((field) => ({
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
      user,
    );
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import dayjs from 'dayjs';
import { AIInteraction } from '../../generated/prisma/client';
import {
  AIExtractionInteractionType,
  ExtractionStatus,
  ExtractionStep,
} from '../../generated/prisma/enums';
import { parseDate } from '../app.utils';
import { UserSession } from '../auth/auth.types';
import { CustomRepresentationQueryDto } from '../common/query-builder';
import { TextExtractionOutputDto } from '../extraction/extraction.dto';
import {
  AsyncError,
  TextExtractionOutput,
  VisionExtractionOutput,
} from '../extraction/extraction.interface';
import { ExtractionService } from '../extraction/extraction.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { VisionExtractionOutputDto } from '../vision/vision.dto';
import { VisionService } from '../vision/vision.service';
import { DocumentCasesQueryService } from './document-cases.query.service';

@Injectable()
export class DocumentCasesCreateService {
  private readonly logger = new Logger(DocumentCasesCreateService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly s3Service: S3Service,
    private readonly extractionService: ExtractionService,
    private readonly documentCasesQueryService: DocumentCasesQueryService,
    private readonly visionService: VisionService,
  ) {}

  async filesExists(images: string[], onFailed?: () => void): Promise<void> {
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

  moveAndGenerateBluredVersions(images: Array<string>, caseNumber: string) {
    return Promise.all(
      images.map(async (image) => {
        const caseImageKey = `${caseNumber}/${image}`;

        // Generate blured version and save to case bucket
        const buffer = await this.s3Service.downloadFile(image, 'tmp');
        const metadata = await this.s3Service.getFileMetadata(image, 'tmp');
        const mimeType =
          metadata?.ContentType ?? `image/${image.split('.').pop()}`;
        const bluredKey = `${caseNumber}/${this.s3Service.generateFileName(image)}`;
        const bluredBuffer = await this.s3Service.blueImage(buffer, 'strong');
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
        await this.s3Service.moveFileToCasesBucket(image, caseNumber);
        return await this.prismaService.documentImage.update({
          where: { document: { case: { caseNumber } }, url: image },
          data: {
            url: caseImageKey,
            blurredUrl: bluredKey,
          },
        });
      }),
    );
  }

  /**
   * Runs only the vision (OCR) step for an extraction.
   * Creates the AIExtractionInteraction record and updates AIExtraction status.
   * Throws UnrecoverableError if images are missing from S3 (no retry possible).
   * Throws a regular Error on vision API failure (will retry).
   */
  async runVisionStep(
    extractionId: string,
    images: string[],
  ): Promise<
    AIInteraction & { parsedResponse: VisionExtractionOutput | null }
  > {
    // Mark as in-progress at the vision step
    await this.prismaService.aIExtraction.update({
      where: { id: extractionId },
      data: {
        extractionStatus: ExtractionStatus.IN_PROGRESS,
        currentStep: ExtractionStep.VISION,
      },
    });

    // Guard against missing images — permanent failure, no retry
    await this.filesExists(images, () => {
      throw new UnrecoverableError(
        'One or more document images could not be found. Please re-upload and try again.',
      );
    });

    // Download images from S3
    const inputImages = await Promise.all(
      images.map(async (image) => {
        const buffer = await this.s3Service.downloadFile(image, 'tmp');
        const metadata = await this.s3Service.getFileMetadata(image, 'tmp');
        const mimeType =
          metadata?.ContentType ?? `image/${image.split('.').pop()}`;
        return { buffer, mimeType };
      }),
    );

    // Run vision extraction
    const visionInteraction =
      await this.visionService.extractTextFromImage(inputImages);

    const hasError = !!(
      visionInteraction.parseError || visionInteraction.callError
    );

    const errorPayload: AsyncError | null = hasError
      ? ((visionInteraction.parseError as unknown as AsyncError) ?? {
          message: visionInteraction.callError,
        })
      : null;

    // Create junction record regardless of success/failure
    await this.prismaService.aIExtractionInteraction.create({
      data: {
        extractionType: AIExtractionInteractionType.VISION_EXTRACTION,
        aiInteractionId: visionInteraction.id,
        aiExtractionId: extractionId,
        success: !hasError,
        errorMessage: hasError ? JSON.stringify(errorPayload) : undefined,
      },
    });

    if (hasError) {
      this.logger.error(
        `Vision step failed for extraction ${extractionId}`,
        JSON.stringify(errorPayload),
      );
      throw new Error(JSON.stringify(errorPayload));
    }

    return visionInteraction as AIInteraction & {
      parsedResponse: VisionExtractionOutput | null;
    };
  }

  /**
   * Runs only the text (structured extraction) step.
   * Expects the vision OCR output from the previous step.
   * Creates the AIExtractionInteraction record.
   */
  async runTextStep(
    extractionId: string,
    visionOutput: VisionExtractionOutputDto,
    user: UserSession['user'],
  ): Promise<AIInteraction & { parsedResponse: TextExtractionOutput | null }> {
    // Mark current step
    await this.prismaService.aIExtraction.update({
      where: { id: extractionId },
      data: { currentStep: ExtractionStep.TEXT },
    });

    const textInteraction = await this.extractionService.extractDocumentData(
      visionOutput,
      user,
    );

    const hasError = !!(
      textInteraction.parseError || textInteraction.callError
    );

    const errorPayload: AsyncError | null = hasError
      ? ((textInteraction.parseError as unknown as AsyncError) ?? {
          message: textInteraction.callError,
        })
      : null;

    // Create junction record
    await this.prismaService.aIExtractionInteraction.create({
      data: {
        extractionType: AIExtractionInteractionType.TEXT_EXTRACTION,
        aiInteractionId: textInteraction.id,
        aiExtractionId: extractionId,
        success: !hasError,
        errorMessage: hasError ? JSON.stringify(errorPayload) : undefined,
      },
    });

    if (hasError) {
      this.logger.error(
        `Text step failed for extraction ${extractionId}`,
        JSON.stringify(errorPayload),
      );
      throw new Error(JSON.stringify(errorPayload));
    }

    return textInteraction as AIInteraction & {
      parsedResponse: TextExtractionOutput | null;
    };
  }

  findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    return this.documentCasesQueryService.findOne(id, query, user);
  }

  /**
   * Applies extracted text output to a Document — only fills currently null/empty fields.
   * Also sets the document type if not yet set.
   * Returns the fields that were updated.
   */
  async applyExtractionToDocument(
    documentId: string,
    documentData: TextExtractionOutputDto,
  ): Promise<void> {
    const existing = await this.prismaService.document.findUnique({
      where: { id: documentId },
      select: {
        documentNumber: true,
        serialNumber: true,
        batchNumber: true,
        fullName: true,
        surname: true,
        givenNames: true,
        dateOfBirth: true,
        placeOfBirth: true,
        gender: true,
        issuer: true,
        placeOfIssue: true,
        issuanceDate: true,
        expiryDate: true,
        addressRaw: true,
        addressCountry: true,
        addressComponents: true,
        fingerprintPresent: true,
        photoPresent: true,
        signaturePresent: true,
      },
    });

    if (!existing) {
      this.logger.warn(
        `Document ${documentId} not found — skipping extraction apply`,
      );
      return;
    }

    const update: Record<string, unknown> = {};

    const setIfNull = <T>(
      currentVal: T | null | undefined,
      extractedVal: T | null | undefined,
      key: string,
    ) => {
      if (
        (currentVal === null || currentVal === undefined) &&
        extractedVal != null
      ) {
        update[key] = extractedVal;
      }
    };

    setIfNull(
      existing.documentNumber,
      documentData.document?.number,
      'documentNumber',
    );
    setIfNull(
      existing.serialNumber,
      documentData.document?.serialNumber,
      'serialNumber',
    );
    setIfNull(
      existing.batchNumber,
      documentData.document?.batchNumber,
      'batchNumber',
    );
    setIfNull(existing.fullName, documentData.person?.fullName, 'fullName');
    setIfNull(existing.surname, documentData.person?.surname, 'surname');
    setIfNull(
      existing.placeOfBirth,
      documentData.person?.placeOfBirth,
      'placeOfBirth',
    );
    setIfNull(existing.gender, documentData.person?.gender, 'gender');
    setIfNull(existing.issuer, documentData.document?.issuer, 'issuer');
    setIfNull(
      existing.placeOfIssue,
      documentData.document?.placeOfIssue,
      'placeOfIssue',
    );
    setIfNull(existing.addressRaw, documentData.address?.raw, 'addressRaw');
    setIfNull(
      existing.addressCountry,
      documentData.address?.country,
      'addressCountry',
    );

    // Arrays — treat empty array as "not provided"
    if (
      (!existing.givenNames || existing.givenNames.length === 0) &&
      documentData.person?.givenNames?.length
    ) {
      update['givenNames'] = documentData.person.givenNames;
    }

    if (
      (!existing.addressComponents ||
        (Array.isArray(existing.addressComponents) &&
          existing.addressComponents.length === 0)) &&
      documentData.address?.components?.length
    ) {
      update['addressComponents'] = documentData.address.components;
    }

    // Dates
    setIfNull(
      existing.dateOfBirth,
      parseDate(documentData.person?.dateOfBirth),
      'dateOfBirth',
    );
    setIfNull(
      existing.issuanceDate,
      parseDate(documentData.document?.issueDate),
      'issuanceDate',
    );

    const extractedExpiry = parseDate(documentData.document?.expiryDate);
    setIfNull(existing.expiryDate, extractedExpiry, 'expiryDate');
    if (extractedExpiry && !existing.expiryDate) {
      update['isExpired'] = dayjs(extractedExpiry).isBefore(dayjs());
    }

    // Biometric flags — only promote false→true; never demote a confirmed true
    if (
      !existing.fingerprintPresent &&
      documentData.biometrics?.fingerprintPresent
    ) {
      update['fingerprintPresent'] = true;
    }
    if (!existing.photoPresent && documentData.biometrics?.photoPresent) {
      update['photoPresent'] = true;
    }
    if (
      !existing.signaturePresent &&
      documentData.biometrics?.signaturePresent
    ) {
      update['signaturePresent'] = true;
    }

    // Additional fields — append only
    const additionalFieldsToAdd =
      documentData.additionalFields?.filter(
        (f) => f.fieldName && f.fieldValue,
      ) ?? [];

    if (Object.keys(update).length > 0 || additionalFieldsToAdd.length > 0) {
      await this.prismaService.document.update({
        where: { id: documentId },
        data: {
          ...update,
          ...(additionalFieldsToAdd.length > 0 && {
            additionalFields: {
              createMany: {
                skipDuplicates: true,
                data: additionalFieldsToAdd.map((f) => ({
                  fieldName: f.fieldName,
                  fieldValue: f.fieldValue,
                })),
              },
            },
          }),
        },
      });
      this.logger.debug(
        `Applied ${Object.keys(update).length} field(s) from extraction to document ${documentId}`,
      );
    }
  }
}

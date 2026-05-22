import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { ExtractionStatus } from '../../generated/prisma/enums';
import { ExtractionStep } from './extraction-step.constants';
import { parseDate } from '../app.utils';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import {
  DocaiExtractionSuccessResult,
  DocaiExtractedFields,
  DocaiStageFailed,
} from './docai.dto';
import { DocaiEvent } from './docai-webhook.schema';

function clamp(v: number | null | undefined): number | null {
  if (v == null) return null;
  return parseFloat(Math.min(1, Math.max(0, v)).toFixed(4));
}

@Injectable()
export class DocaiWebhookService {
  private readonly logger = new Logger(DocaiWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchService,
    private readonly s3: S3Service,
  ) {}

  /** extraction.vision.success — OCR done, structure stage now running. */
  async handleVisionSuccess(jobId: string): Promise<void> {
    await this.prisma.aIExtraction.update({
      where: { docaiJobId: jobId },
      data: {
        extractionStatus: ExtractionStatus.IN_PROGRESS,
        currentStep: ExtractionStep.STRUCTURE,
      },
    });
  }

  /** extraction.structure.success — structure done, extraction.success fires next. */
  async handleStructureSuccess(jobId: string): Promise<void> {
    // Structure completed — extraction.success (with the combined result) fires
    // immediately after. No DB write needed here; handleExtractionSuccess will
    // mark COMPLETED. Just log for observability.
    this.logger.debug(`Docai job ${jobId} — structure complete, awaiting extraction.success`);
  }

  /** extraction.success — terminal happy path; apply fields and notify user. */
  async handleExtractionSuccess(jobId: string, result: DocaiExtractionSuccessResult): Promise<void> {
    const extraction = await this.prisma.aIExtraction.findUnique({
      where: { docaiJobId: jobId },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            userId: true,
            document: {
              select: {
                id: true,
                images: { select: { url: true } },
                type: { select: { name: true } },
              },
            },
            lostDocumentCase: { select: { id: true } },
            foundDocumentCase: { select: { id: true } },
          },
        },
      },
    });

    if (!extraction) {
      this.logger.warn(`No extraction found for docai job ${jobId} — skipping extraction.success`);
      return;
    }

    const documentCase = extraction.case;
    const document = documentCase.document;
    const userId = documentCase.userId;
    const caseType = documentCase.lostDocumentCase ? 'LOST' : 'FOUND';

    // extraction.success carries { vision: VisionResult, structure: ExtractedFields }
    const fields = result.structure as DocaiExtractedFields;
    const ocrConfidence = (result.vision as { averageConfidence?: number | null })
      .averageConfidence ?? null;
    const extractionConfidence = fields.quality?.extractionConfidence ?? null;
    const warnings = (fields.quality?.warnings ?? []) as string[];

    if (document) {
      await this.applyFieldsToDocument(document.id, fields);
    }

    if (document?.images.length) {
      const imageKeys = document.images.map((img) => img.url);
      await this.moveAndBlurImages(imageKeys, documentCase.caseNumber).catch(
        (e: unknown) =>
          this.logger.error(
            `Image move/blur failed for case ${documentCase.caseNumber}`,
            e,
          ),
      );
    }

    await this.prisma.aIExtraction.update({
      where: { docaiJobId: jobId },
      data: {
        extractionStatus: ExtractionStatus.COMPLETED,
        currentStep: null,
        ocrConfidence: clamp(ocrConfidence),
        extractionConfidence: clamp(extractionConfidence),
        documentTypeCode: fields.documentType?.code ?? null,
        warnings,
      },
    });

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, phoneNumber: true },
      });

      if (user) {
        const templateKey =
          caseType === 'FOUND'
            ? 'notification.case.found.extraction.complete'
            : 'notification.case.lost.extraction.complete';

        await this.notifications.sendFromTemplate({
          templateKey,
          recipient: {
            email: user.email ?? undefined,
            phone: user.phoneNumber ?? undefined,
          },
          data: {
            case: {
              id: documentCase.id,
              caseNumber: documentCase.caseNumber,
              document: { type: { name: document?.type?.name ?? 'document' } },
            },
            user: { name: user.name },
          },
          userId,
          priority: NotificationPriority.NORMAL,
          eventTitle: 'Document Details Extracted',
          eventBody: `Details extracted from your ${document?.type?.name ?? 'document'} images — please review case #${documentCase.caseNumber} to confirm they are correct.`,
          eventDescription: `Docai extraction completed for ${caseType} case ${documentCase.caseNumber} (docai job ${jobId})`,
        });
      }
    }

    this.logger.log(`Docai job ${jobId} extraction.success — case ${documentCase.caseNumber}`);
  }

  /** extraction.vision.failed / extraction.structure.failed — terminal stage failure. */
  async handleStageFailed(jobId: string, event: DocaiEvent, result: DocaiStageFailed): Promise<void> {
    const extraction = await this.prisma.aIExtraction.findUnique({
      where: { docaiJobId: jobId },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            userId: true,
            document: { select: { type: { select: { name: true } } } },
            lostDocumentCase: { select: { id: true } },
            foundDocumentCase: { select: { id: true } },
          },
        },
      },
    });

    if (!extraction) {
      this.logger.warn(`No extraction found for docai job ${jobId} — skipping ${event}`);
      return;
    }

    await this.prisma.aIExtraction.update({
      where: { docaiJobId: jobId },
      data: {
        extractionStatus: ExtractionStatus.FAILED,
        currentStep: null,
      },
    });

    const documentCase = extraction.case;
    const userId = documentCase.userId;
    const caseType = documentCase.lostDocumentCase ? 'LOST' : 'FOUND';

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, phoneNumber: true },
      });

      if (user) {
        const templateKey =
          caseType === 'FOUND'
            ? 'notification.case.found.extraction.failed'
            : 'notification.case.lost.extraction.failed';

        void this.notifications
          .sendFromTemplate({
            templateKey,
            recipient: {
              email: user.email ?? undefined,
              phone: user.phoneNumber ?? undefined,
            },
            data: {
              case: {
                id: documentCase.id,
                caseNumber: documentCase.caseNumber,
                document: {
                  type: { name: documentCase.document?.type?.name ?? 'document' },
                },
              },
              user: { name: user.name },
              isImageError: event === DocaiEvent.EXTRACTION_VISION_FAILED,
            },
            userId,
            priority: NotificationPriority.NORMAL,
            eventTitle: 'Document Scan Unsuccessful',
            eventBody: `We were unable to scan your ${documentCase.document?.type?.name ?? 'document'} images for case #${documentCase.caseNumber}. Please open your case to review and try again.`,
            eventDescription: `Docai job ${jobId} FAILED (${event}) for ${caseType} case ${documentCase.caseNumber}: ${result.reason}`,
          })
          .catch((e: unknown) =>
            this.logger.error(
              `Failed to send extraction-failure notification for docai job ${jobId}`,
              e,
            ),
          );
      }
    }

    this.logger.error(`Docai job ${jobId} failed — event=${event}: ${result.reason}`);
  }

  private async applyFieldsToDocument(
    documentId: string,
    fields: DocaiExtractedFields,
  ): Promise<void> {
    const existing = await this.prisma.document.findUnique({
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

    if (!existing) return;

    const update: Record<string, unknown> = {};
    const setIfNull = <T>(
      current: T | null | undefined,
      extracted: T | null | undefined,
      key: string,
    ) => {
      if ((current === null || current === undefined) && extracted != null) {
        update[key] = extracted;
      }
    };

    const { person, document, address, biometrics, additionalFields } = fields;

    setIfNull(existing.documentNumber, document?.number, 'documentNumber');
    setIfNull(existing.serialNumber, document?.serialNumber, 'serialNumber');
    setIfNull(existing.batchNumber, document?.batchNumber, 'batchNumber');
    setIfNull(existing.fullName, person?.fullName, 'fullName');
    setIfNull(existing.surname, person?.surname, 'surname');
    setIfNull(existing.placeOfBirth, person?.placeOfBirth, 'placeOfBirth');
    setIfNull(existing.gender, person?.gender, 'gender');
    setIfNull(existing.issuer, document?.issuer, 'issuer');
    setIfNull(existing.placeOfIssue, document?.placeOfIssue, 'placeOfIssue');
    setIfNull(existing.addressRaw, address?.raw, 'addressRaw');
    setIfNull(existing.addressCountry, address?.country, 'addressCountry');

    if (
      (!existing.givenNames || existing.givenNames.length === 0) &&
      person?.givenNames?.length
    ) {
      update['givenNames'] = person.givenNames;
    }

    if (
      (!existing.addressComponents ||
        (Array.isArray(existing.addressComponents) &&
          existing.addressComponents.length === 0)) &&
      address?.components?.length
    ) {
      update['addressComponents'] = address.components;
    }

    setIfNull(
      existing.dateOfBirth,
      parseDate(person?.dateOfBirth ?? undefined),
      'dateOfBirth',
    );
    setIfNull(
      existing.issuanceDate,
      parseDate(document?.issueDate ?? undefined),
      'issuanceDate',
    );

    const extractedExpiry = parseDate(document?.expiryDate ?? undefined);
    setIfNull(existing.expiryDate, extractedExpiry, 'expiryDate');
    if (extractedExpiry && !existing.expiryDate) {
      update['isExpired'] = dayjs(extractedExpiry).isBefore(dayjs());
    }

    if (!existing.fingerprintPresent && biometrics?.fingerprintPresent) {
      update['fingerprintPresent'] = true;
    }
    if (!existing.photoPresent && biometrics?.photoPresent) {
      update['photoPresent'] = true;
    }
    if (!existing.signaturePresent && biometrics?.signaturePresent) {
      update['signaturePresent'] = true;
    }

    const additionalFieldsToAdd =
      additionalFields?.filter((f) => f.fieldName && f.fieldValue) ?? [];

    if (Object.keys(update).length > 0 || additionalFieldsToAdd.length > 0) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          ...update,
          ...(additionalFieldsToAdd.length > 0 && {
            additionalFields: {
              createMany: {
                skipDuplicates: true,
                data: additionalFieldsToAdd,
              },
            },
          }),
        },
      });
    }
  }

  private async moveAndBlurImages(
    imageKeys: string[],
    caseNumber: string,
  ): Promise<void> {
    await Promise.all(
      imageKeys.map(async (key) => {
        const buffer = await this.s3.downloadFile(key, 'tmp');
        const metadata = await this.s3.getFileMetadata(key, 'tmp');
        const mimeType =
          metadata?.ContentType ?? `image/${key.split('.').pop()}`;

        const blurredKey = `${caseNumber}/${this.s3.generateFileName(key)}`;
        const blurredBuffer = await this.s3.blueImage(buffer, 'strong');
        await this.s3.uploadFile(blurredKey, 'cases', blurredBuffer, mimeType, {
          isBlurred: 'true',
          originalKey: `${caseNumber}/${key}`,
        });

        await this.s3.moveFileToCasesBucket(key, caseNumber);

        await this.prisma.documentImage.update({
          where: { document: { case: { caseNumber } }, url: key },
          data: {
            url: `${caseNumber}/${key}`,
            blurredUrl: blurredKey,
          },
        });
      }),
    );
  }
}

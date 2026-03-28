import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import dayjs from 'dayjs';
import { AIExtractionInteractionType } from '../../generated/prisma/enums';
import { parseDate } from '../app.utils';
import { TextExtractionOutputDto } from '../extraction/extraction.dto';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserSession } from '../auth/auth.types';
import { DocumentCasesCreateService } from './document-cases.create.service';
import { LOST_CASE_EXTRACTION_QUEUE } from './document-cases.constants';
import { LostCaseExtractionJob } from './document-cases.interface';

type UserRow = {
  id: string;
  email: string | null;
  name: string;
  phoneNumber: string | null;
};

type CaseRow = {
  caseNumber: string;
  document: { type: { name: string } } | null;
};

@Processor(LOST_CASE_EXTRACTION_QUEUE, { concurrency: 3 })
export class LostCaseExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(LostCaseExtractionProcessor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly documentCasesCreateService: DocumentCasesCreateService,
    private readonly notificationService: NotificationDispatchService,
  ) {
    super();
  }

  async process(job: Job<LostCaseExtractionJob>): Promise<void> {
    const jobData = job.data;
    const { caseId, documentId, extractionId, images, userId } = jobData;
    this.logger.log(
      `Processing lost-case extraction job ${job.id ?? 'unknown'} for case ${caseId}`,
    );

    // Declare outside try so the catch block can use them for the failure notification
    let user: UserRow | null = null;
    let documentCase: CaseRow | null = null;

    try {
      // Fetch user + case first so they are available in both success and failure paths
      [user, documentCase] = await Promise.all([
        this.prismaService.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true, phoneNumber: true },
        }),
        this.prismaService.documentCase.findUnique({
          where: { id: caseId },
          select: {
            caseNumber: true,
            document: { select: { type: { select: { name: true } } } },
          },
        }),
      ]);

      // Guard against images expiring between enqueue and processing.
      // Fail permanently — no retry will recover a missing upload.
      await this.documentCasesCreateService.filesExists(images, () => {
        throw new UnrecoverableError(
          'One or more document images could not be found. Please re-upload the images and try again.',
        );
      });

      // Run AI extraction (vision + text)
      const extraction = await this.documentCasesCreateService.runAiExtraction(
        extractionId,
        images,
        { id: userId } as UserSession['user'],
      );

      // Pull extracted document data from the TEXT_EXTRACTION interaction
      const documentData = extraction.aiextractionInteractions.find(
        (i) => i.extractionType === AIExtractionInteractionType.TEXT_EXTRACTION,
      )?.aiInteraction?.parsedResponse as unknown as TextExtractionOutputDto;

      if (!documentData) {
        this.logger.warn(
          `No TEXT_EXTRACTION interaction found for extraction ${extractionId} — skipping document update`,
        );
        return;
      }

      // Load current document fields so we can skip non-null values
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
          `Document ${documentId} not found — skipping update for case ${caseId}`,
        );
        return;
      }

      // Build update payload — only fill fields that are currently null/empty.
      // We never override a value the reporter explicitly provided.
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

      // Recompute isExpired only if we just set the expiry date
      if (extractedExpiry && !existing.expiryDate) {
        update['isExpired'] = dayjs(extractedExpiry).isBefore(dayjs());
      }

      // Biometric flags — only promote false→true; never demote a user-confirmed true
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

      // Additional fields — append only (skipDuplicates prevents collision)
      const additionalFieldsToAdd =
        documentData.additionalFields?.filter(
          (f) => f.fieldName && f.fieldValue,
        ) ?? [];

      // Apply document update
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
          `Updated document ${documentId} with ${Object.keys(update).length} field(s) from extraction`,
        );
      } else {
        this.logger.debug(
          `No new fields to fill for document ${documentId} — all fields already provided`,
        );
      }

      // Move images from tmp bucket → cases bucket and generate blurred versions
      if (documentCase) {
        await this.documentCasesCreateService.moveAndGenerateBluredVersions(
          images,
          documentCase.caseNumber,
        );
      }

      // Notify user that extraction completed and they should review the case
      if (user) {
        await this.notificationService.sendFromTemplate({
          templateKey: 'notification.case.lost.extraction.complete',
          recipient: {
            email: user.email ?? undefined,
            phone: user.phoneNumber ?? undefined,
          },
          data: {
            case: {
              id: caseId,
              caseNumber: documentCase?.caseNumber ?? caseId,
              document: {
                type: {
                  name: documentCase?.document?.type?.name ?? 'Document',
                },
              },
            },
            user: { name: user.name },
          },
          userId: user.id,
          priority: NotificationPriority.NORMAL,
          eventTitle: 'Document Details Extracted',
          eventBody: `Details extracted from your ${documentCase?.document?.type?.name ?? 'document'} images — please review case #${documentCase?.caseNumber ?? caseId} to confirm they are correct.`,
          eventDescription: `Background AI extraction completed for lost case ${caseId} (document ${documentId}, extraction ${extractionId})`,
        });
      }

      this.logger.log(
        `Lost-case extraction job ${job.id ?? 'unknown'} completed for case ${caseId}`,
      );
    } catch (error: unknown) {
      // Determine if this is a permanent failure — either explicitly unrecoverable
      // or the last retry attempt has just been exhausted
      const isPermanent =
        error instanceof UnrecoverableError ||
        job.attemptsMade >= (job.opts.attempts ?? 3) - 1;

      if (isPermanent) {
        this.logger.error(
          `Permanent failure on lost-case extraction job ${job.id ?? 'unknown'} for case ${caseId}`,
          error,
        );

        // Notify user so they can take action — don't let notification failure
        // mask or suppress the original extraction error
        if (user) {
          void this.notificationService
            .sendFromTemplate({
              templateKey: 'notification.case.lost.extraction.failed',
              recipient: {
                email: user.email ?? undefined,
                phone: user.phoneNumber ?? undefined,
              },
              data: {
                case: {
                  id: caseId,
                  caseNumber: documentCase?.caseNumber ?? caseId,
                  document: {
                    type: {
                      name: documentCase?.document?.type?.name ?? 'document',
                    },
                  },
                },
                user: { name: user.name },
                isImageError: error instanceof UnrecoverableError,
              },
              userId: user.id,
              priority: NotificationPriority.NORMAL,
              eventTitle: 'Document Scan Unsuccessful',
              eventBody: `We were unable to scan your ${documentCase?.document?.type?.name ?? 'document'} images for case #${documentCase?.caseNumber ?? caseId}. Please open your case to review and try again.`,
              eventDescription: `Extraction failed permanently for lost case ${caseId} (extraction ${extractionId}): ${String(error instanceof Error ? error.message : error)}`,
            })
            .catch((e: unknown) =>
              this.logger.error(
                `Failed to send extraction-failure notification to user ${userId}`,
                e,
              ),
            );
        }
      }

      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<LostCaseExtractionJob>, error: Error) {
    const jobData = job.data;
    const { caseId, extractionId } = jobData;

    const isPermanent =
      error instanceof UnrecoverableError ||
      job.attemptsMade >= (job.opts.attempts ?? 3);

    if (isPermanent) {
      this.logger.error(
        `[#Attempt ${job.attemptsMade}] Lost-case extraction job ${job.id ?? 'unknown'} permanently failed for case ${caseId}`,
        error,
      );
      // Mark the extraction record as failed so the app can surface the error state
      void this.prismaService.aIExtraction
        .update({
          where: { id: extractionId },
          data: { success: false },
        })
        .catch((e: unknown) =>
          this.logger.error(
            `Failed to mark extraction ${extractionId} as failed`,
            e,
          ),
        );
    } else {
      this.logger.warn(
        `[#Attempt ${job.attemptsMade}] Lost-case extraction job ${job.id ?? 'unknown'} failed for case ${caseId} — retrying`,
        error,
      );
    }
  }
}

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import {
  AIExtractionInteractionType,
  ExtractionStatus,
  ExtractionStep,
} from '../../generated/prisma/enums';
import { TextExtractionOutputDto } from '../extraction/extraction.dto';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentCasesCreateService } from './document-cases.create.service';
import { CASE_POST_PROCESSING_QUEUE } from './document-cases.constants';
import { CaseExtractionJob } from './document-cases.interface';

type UserRow = {
  id: string;
  email: string | null;
  name: string;
  phoneNumber: string | null;
};

type CaseRow = {
  caseNumber: string;
  document: { type: { name: string } | null } | null;
};

@Processor(CASE_POST_PROCESSING_QUEUE, { concurrency: 3 })
export class CasePostProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(CasePostProcessingProcessor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly documentCasesCreateService: DocumentCasesCreateService,
    private readonly notificationService: NotificationDispatchService,
  ) {
    super();
  }

  async process(job: Job<CaseExtractionJob>): Promise<void> {
    const { caseId, documentId, extractionId, images, userId, caseType } =
      job.data;
    this.logger.log(
      `Processing post-processing job ${job.id ?? 'unknown'} for case ${caseId}`,
    );

    let user: UserRow | null = null;
    let documentCase: CaseRow | null = null;

    try {
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

      // Mark as post-processing step
      await this.prismaService.aIExtraction.update({
        where: { id: extractionId },
        data: { currentStep: ExtractionStep.POST_PROCESSING },
      });

      // Get text extraction output from the successful text interaction
      const textInteraction =
        await this.prismaService.aIExtractionInteraction.findFirst({
          where: {
            aiExtractionId: extractionId,
            extractionType: AIExtractionInteractionType.TEXT_EXTRACTION,
            success: true,
          },
          include: { aiInteraction: true },
        });

      if (!textInteraction) {
        throw new UnrecoverableError(
          `Text extraction interaction not found for extraction ${extractionId}`,
        );
      }

      const documentData =
        textInteraction.aiInteraction
          .parsedResponse as unknown as TextExtractionOutputDto;

      if (!documentData) {
        throw new UnrecoverableError(
          `Text extraction output is null for extraction ${extractionId}`,
        );
      }

      // Apply extracted data to the document
      await this.documentCasesCreateService.applyExtractionToDocument(
        documentId,
        documentData,
      );

      // Move images from tmp → cases bucket and generate blurred versions
      if (documentCase && images?.length) {
        await this.documentCasesCreateService.moveAndGenerateBluredVersions(
          images,
          documentCase.caseNumber,
        );
      }

      // Mark extraction as complete with rolled-up quality metrics
      await this.prismaService.aIExtraction.update({
        where: { id: extractionId },
        data: {
          extractionStatus: ExtractionStatus.COMPLETED,
          currentStep: null,
          ocrConfidence: documentData.quality?.ocrConfidence ?? null,
          extractionConfidence: documentData.quality?.extractionConfidence ?? null,
          documentTypeCode: documentData.documentType?.code ?? null,
          warnings: documentData.quality?.warnings ?? [],
        },
      });

      // Notify user that extraction completed
      if (user) {
        const templateKey =
          caseType === 'FOUND'
            ? 'notification.case.found.extraction.complete'
            : 'notification.case.lost.extraction.complete';

        await this.notificationService.sendFromTemplate({
          templateKey,
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
          eventDescription: `Background AI extraction completed for ${caseType} case ${caseId} (document ${documentId}, extraction ${extractionId})`,
        });
      }

      this.logger.log(
        `Post-processing job ${job.id ?? 'unknown'} completed for case ${caseId}`,
      );
    } catch (error: unknown) {
      const isPermanent =
        error instanceof UnrecoverableError ||
        job.attemptsMade >= (job.opts.attempts ?? 3) - 1;

      if (isPermanent && user) {
        const templateKey =
          caseType === 'FOUND'
            ? 'notification.case.found.extraction.failed'
            : 'notification.case.lost.extraction.failed';

        void this.notificationService
          .sendFromTemplate({
            templateKey,
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
              isImageError: false,
            },
            userId: user.id,
            priority: NotificationPriority.NORMAL,
            eventTitle: 'Document Scan Unsuccessful',
            eventBody: `We were unable to finalise processing your ${documentCase?.document?.type?.name ?? 'document'} images for case #${documentCase?.caseNumber ?? caseId}. Please open your case to review and try again.`,
            eventDescription: `Post-processing failed permanently for ${caseType} case ${caseId} (extraction ${extractionId}): ${String(error instanceof Error ? error.message : error)}`,
          })
          .catch((e: unknown) =>
            this.logger.error(
              `Failed to send extraction-failure notification to user ${userId}`,
              e,
            ),
          );
      }

      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CaseExtractionJob>, error: Error) {
    const { caseId, extractionId } = job.data;
    const isPermanent =
      error instanceof UnrecoverableError ||
      job.attemptsMade >= (job.opts.attempts ?? 3);

    if (isPermanent) {
      this.logger.error(
        `[#Attempt ${job.attemptsMade}] Post-processing job ${job.id ?? 'unknown'} permanently failed for case ${caseId}`,
        error,
      );
      void this.prismaService.aIExtraction
        .update({
          where: { id: extractionId },
          data: { extractionStatus: ExtractionStatus.FAILED },
        })
        .catch((e: unknown) =>
          this.logger.error(
            `Failed to mark extraction ${extractionId} as FAILED`,
            e,
          ),
        );
    } else {
      this.logger.warn(
        `[#Attempt ${job.attemptsMade}] Post-processing job ${job.id ?? 'unknown'} failed for case ${caseId} — retrying`,
        error,
      );
    }
  }
}

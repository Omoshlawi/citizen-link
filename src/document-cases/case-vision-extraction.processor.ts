import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import {
  AIExtractionInteractionType,
  ExtractionStatus,
} from '../../generated/prisma/enums';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentCasesCreateService } from './document-cases.create.service';
import {
  CASE_TEXT_EXTRACTION_QUEUE,
  CASE_VISION_EXTRACTION_QUEUE,
} from './document-cases.constants';
import { CaseExtractionJob } from './document-cases.interface';
import { UserSession } from '../auth/auth.types';

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

@Processor(CASE_VISION_EXTRACTION_QUEUE, { concurrency: 5 })
export class CaseVisionExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(CaseVisionExtractionProcessor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly documentCasesCreateService: DocumentCasesCreateService,
    private readonly notificationService: NotificationDispatchService,
    @InjectQueue(CASE_TEXT_EXTRACTION_QUEUE)
    private readonly textQueue: Queue<CaseExtractionJob>,
  ) {
    super();
  }

  async process(job: Job<CaseExtractionJob>): Promise<void> {
    const { caseId, documentId, extractionId, images, userId, caseType } =
      job.data;
    this.logger.log(
      `Processing vision extraction job ${job.id ?? 'unknown'} for case ${caseId}`,
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

      // Step-skip: if vision already succeeded, advance to text queue immediately
      const existingVision =
        await this.prismaService.aIExtractionInteraction.findFirst({
          where: {
            aiExtractionId: extractionId,
            extractionType: AIExtractionInteractionType.VISION_EXTRACTION,
            success: true,
          },
        });

      if (existingVision) {
        this.logger.debug(
          `Vision already completed for extraction ${extractionId} — advancing to text queue`,
        );
        await this.textQueue.add('extract-text', job.data);
        return;
      }

      // Run vision step
      await this.documentCasesCreateService.runVisionStep(extractionId, images);

      // Vision succeeded — enqueue text step
      await this.textQueue.add('extract-text', job.data);

      this.logger.log(
        `Vision job ${job.id ?? 'unknown'} completed for case ${caseId} — text job queued`,
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
              isImageError: error instanceof UnrecoverableError,
            },
            userId: user.id,
            priority: NotificationPriority.NORMAL,
            eventTitle: 'Document Scan Unsuccessful',
            eventBody: `We were unable to scan your ${documentCase?.document?.type?.name ?? 'document'} images for case #${documentCase?.caseNumber ?? caseId}. Please open your case to review and try again.`,
            eventDescription: `Vision extraction failed permanently for ${caseType} case ${caseId} (extraction ${extractionId}): ${String(error instanceof Error ? error.message : error)}`,
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
        `[#Attempt ${job.attemptsMade}] Vision job ${job.id ?? 'unknown'} permanently failed for case ${caseId}`,
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
        `[#Attempt ${job.attemptsMade}] Vision job ${job.id ?? 'unknown'} failed for case ${caseId} — retrying`,
        error,
      );
    }
  }
}

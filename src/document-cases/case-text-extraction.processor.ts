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
  CASE_POST_PROCESSING_QUEUE,
  CASE_TEXT_EXTRACTION_QUEUE,
} from './document-cases.constants';
import { CaseExtractionJob } from './document-cases.interface';
import { VisionExtractionOutputDto } from '../vision/vision.dto';
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

@Processor(CASE_TEXT_EXTRACTION_QUEUE, { concurrency: 5 })
export class CaseTextExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(CaseTextExtractionProcessor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly documentCasesCreateService: DocumentCasesCreateService,
    private readonly notificationService: NotificationDispatchService,
    @InjectQueue(CASE_POST_PROCESSING_QUEUE)
    private readonly postProcessingQueue: Queue<CaseExtractionJob>,
  ) {
    super();
  }

  async process(job: Job<CaseExtractionJob>): Promise<void> {
    const { caseId, extractionId, userId, caseType } = job.data;
    this.logger.log(
      `Processing text extraction job ${job.id ?? 'unknown'} for case ${caseId}`,
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

      // Step-skip: if text already succeeded, advance to post-processing immediately
      const existingText =
        await this.prismaService.aIExtractionInteraction.findFirst({
          where: {
            aiExtractionId: extractionId,
            extractionType: AIExtractionInteractionType.TEXT_EXTRACTION,
            success: true,
          },
        });

      if (existingText) {
        this.logger.debug(
          `Text already completed for extraction ${extractionId} — advancing to post-processing queue`,
        );
        await this.postProcessingQueue.add('post-process', job.data);
        return;
      }

      // Get vision output from the existing successful vision interaction
      const visionInteraction =
        await this.prismaService.aIExtractionInteraction.findFirst({
          where: {
            aiExtractionId: extractionId,
            extractionType: AIExtractionInteractionType.VISION_EXTRACTION,
            success: true,
          },
          include: { aiInteraction: true },
        });

      if (!visionInteraction) {
        throw new Error(
          `Vision step not yet completed for extraction ${extractionId}`,
        );
      }

      const visionOutput =
        visionInteraction.aiInteraction
          .parsedResponse as unknown as VisionExtractionOutputDto;

      // Run text step
      await this.documentCasesCreateService.runTextStep(
        extractionId,
        visionOutput,
        { id: userId } as UserSession['user'],
      );

      // Text succeeded — enqueue post-processing step
      await this.postProcessingQueue.add('post-process', job.data);

      this.logger.log(
        `Text job ${job.id ?? 'unknown'} completed for case ${caseId} — post-processing queued`,
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
                id: job.data.caseId,
                caseNumber: documentCase?.caseNumber ?? job.data.caseId,
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
            eventBody: `We were unable to process your ${documentCase?.document?.type?.name ?? 'document'} images for case #${documentCase?.caseNumber ?? job.data.caseId}. Please open your case to review and try again.`,
            eventDescription: `Text extraction failed permanently for ${caseType} case ${caseId} (extraction ${extractionId}): ${String(error instanceof Error ? error.message : error)}`,
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
        `[#Attempt ${job.attemptsMade}] Text job ${job.id ?? 'unknown'} permanently failed for case ${caseId}`,
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
        `[#Attempt ${job.attemptsMade}] Text job ${job.id ?? 'unknown'} failed for case ${caseId} — retrying`,
        error,
      );
    }
  }
}

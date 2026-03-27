import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { DOCUMENT_MATCHING_QUEUE } from './matching.constants';
import { Job } from 'bullmq';
import { DocumentMatchingJobData } from './matching.interface';
import { MatchingLayeredService } from './matching.layered.service';
import { Logger } from '@nestjs/common';
import {
  DocumentCase,
  FoundDocumentCase,
  LostDocumentCase,
  Match,
  User,
  Document,
  DocumentType,
  NotificationChannel,
} from '../../generated/prisma/client';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { NotificationPriority } from 'src/notifications/notification.interfaces';

@Processor(DOCUMENT_MATCHING_QUEUE, { concurrency: 5 })
export class DocumentMatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentMatchingProcessor.name);
  constructor(
    private readonly matchingLayeredService: MatchingLayeredService,
    private readonly notificationService: NotificationDispatchService,
  ) {
    super();
  }

  async process(job: Job<DocumentMatchingJobData>): Promise<any> {
    this.logger.log(
      `Processing - Matching job ${job.id} for document ${job.data.documentId} | Trigger: ${job.data.trigger} | User: ${job.data.userId}`,
    );
    const res = await this.matchingLayeredService.layeredMatching(
      job.data.trigger,
      job.data.documentId,
      job.data.userId,
    );
    return res;
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<DocumentMatchingJobData>) {
    const matches = job.returnvalue as Array<
      Match & {
        foundDocumentCase: FoundDocumentCase & {
          case: DocumentCase & {
            user: User;
            document: Document & {
              type: Pick<DocumentType, 'id' | 'name' | 'code'>;
            };
          };
        };
        lostDocumentCase: LostDocumentCase & {
          case: DocumentCase & {
            user: User;
            document: Document & {
              type: Pick<DocumentType, 'id' | 'name' | 'code'>;
            };
          };
        };
      }
    >;
    this.logger.log(
      `Match Job ${job.id} completed for document ${job.data.documentId} | Found ${matches.length} matches | Matches: ${matches.length ? matches.map((m) => m.matchNumber).join(', ') : 'None found'}`,
    );
    //  Notify users of matches if any found
    if (matches.length > 0) {
      this.logger.log(`Notify users of matches if any found`);
      // 1. Trigger notification for owner of the new match
      const ownerPromises = matches.map(async (match) => {
        await this.notificationService.sendFromTemplate({
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.HIGH,
          templateKey: 'notification.case.found.matched', // TODO: set template name to system settings and use it to access the template key
          data: {
            match,
          },
          userId: match.lostDocumentCase.case.userId,
          eventTitle: 'Match Found',
          eventBody: `A potential match was found for your lost ${match.lostDocumentCase.case.document.type.name} (No. ${match.lostDocumentCase.case.document.documentNumber}).`,
          eventDescription: `Match ${match.matchNumber} — lost case ${match.lostDocumentCase.id} matched to found document ${match.foundDocumentCase.case.document.documentNumber}`,
        });
      });
      // 2. Trigger notification for finder of the new match
      const founderPromises = matches.map(async (match) => {
        await this.notificationService.sendFromTemplate({
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.HIGH,
          templateKey: 'notification.case.lost.matched', // TODO: set template name to system settings and use it to access the template key
          data: {
            match,
          },
          userId: match.foundDocumentCase.case.userId,
          eventTitle: 'Match Found',
          eventBody: `The ${match.foundDocumentCase.case.document.type.name} (No. ${match.foundDocumentCase.case.document.documentNumber}) you found has been matched to a lost report`,
          eventDescription: `Match ${match.matchNumber} — found case ${match.foundDocumentCase.id} matched to lost document ${match.lostDocumentCase.case.document.documentNumber}`,
        });
      });
      await Promise.all([...ownerPromises, ...founderPromises]);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DocumentMatchingJobData>, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      this.logger.error(
        `[#Attempt ${job.attemptsMade}] Job failed: ${job.id} - Failed to match Document ${job.data.documentId}`,
        error,
      );
    } else {
      this.logger.warn(
        `[#Attempt ${job.attemptsMade}] Job failed: ${job.id} - Failed to match Document ${job.data.documentId} . Retrying...`,
        error,
      );
    }
  }
}

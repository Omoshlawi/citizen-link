import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { DOCUMENT_MATCHING_QUEUE } from './matching.constants';
import { Job } from 'bullmq';
import { DocumentMatchingJobData } from './matching.interface';
import { MatchingLayeredService } from './matching.layered.service';
import { Logger } from '@nestjs/common';
import { Match } from '../../generated/prisma/client';

@Processor(DOCUMENT_MATCHING_QUEUE, { concurrency: 5 })
export class DocumentMatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentMatchingProcessor.name);
  constructor(private readonly matchingLayeredService: MatchingLayeredService) {
    super();
  }

  async process(job: Job<DocumentMatchingJobData>): Promise<any> {
    const res = await this.matchingLayeredService.layeredMatching(
      job.data.trigger,
      job.data.documentId,
      job.data.userId,
    );
    return res;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<DocumentMatchingJobData>) {
    const matches = job.returnvalue as Array<Match>;
    this.logger.log(
      `Match Job ${job.id} completed for document ${job.data.documentId} | Found ${matches.length} matches | Matches: ${matches.map((m) => m.matchNumber).join(', ')}`,
    );
    // TODO: Notify users of matches
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

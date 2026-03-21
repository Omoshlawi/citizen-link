import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MatchingLayeredService } from '../matching/matching.layered.service';
import { DOCUMENT_EMBEDDING_QUEUE } from './document-cases.constants';
import { EmbeddingService } from '../embedding/embedding.service';
import { DocumentEmbeddingJob } from './document-cases.interface';

@Processor(DOCUMENT_EMBEDDING_QUEUE, { concurrency: 5 })
export class DocumentEmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentEmbeddingProcessor.name);
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly matchingLayeredService: MatchingLayeredService,
  ) {
    super();
  }
  async process(job: Job<DocumentEmbeddingJob>): Promise<any> {
    const { documentId } = job.data;
    await this.embeddingService.embeddDocument(documentId);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<DocumentEmbeddingJob>) {
    this.logger.log(
      `Job completed: ${job.id} - Document ${job.data.documentId} has been indexed succesfully. Triggering match algorithm`,
    );
    await this.matchingLayeredService.queueDocumentMatchingJob(
      job.data.trigger,
      job.data.documentId,
      job.data.userId,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DocumentEmbeddingJob>, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      this.logger.error(
        `[#Attempt ${job.attemptsMade}] Job failed: ${job.id} - Failed to index Document ${job.data.documentId}`,
        error,
      );
    } else {
      this.logger.warn(
        `[#Attempt ${job.attemptsMade}] Job failed: ${job.id} - Failed to index Document ${job.data.documentId} . Retrying...`,
        error,
      );
    }
  }
}

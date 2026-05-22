import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { DocaiModule } from '../docai/docai.module';
import { EmbeddingConfig } from '../embedding/embedding.config';
import { EmbeddingModule } from '../embedding/embedding.module';
import { MatchingModule } from '../matching/matching.module';
import { MatchingConfig } from '../matching/matching.config';
import { DOCUMENT_EMBEDDING_QUEUE } from './document-cases.constants';
import { DocumentCasesController } from './document-cases.controller';
import { DocumentCasesService } from './document-cases.service';
import { DocumentCasesCreateService } from './document-cases.create.service';
import { DocumentCasesQueryService } from './document-cases.query.service';
import { DocumentCasesWorkflowService } from './documnt-cases.workflow.service';
import { DocumentEmbeddingProcessor } from './document.processor';
import { DocumentCaseGateway } from './document-case.gateway';
import { DocumentCasesTimelineService } from './document-cases.timeline.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DOCUMENT_EMBEDDING_QUEUE,
      defaultJobOptions: {
        priority: 5,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 60 * 60 * 24 },
        removeOnFail: { age: 60 * 60 * 24 * 7 },
      },
    }),
    BullBoardModule.forFeature({
      name: DOCUMENT_EMBEDDING_QUEUE,
      adapter: BullMQAdapter,
    }),
    DocaiModule,
    EmbeddingModule.registerAsync({
      useFactory: (config: EmbeddingConfig) => ({
        model: config.model,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        isOpenAi: config.isOpenAi,
      }),
      inject: [EmbeddingConfig],
    }),
    MatchingModule.registerAsync({
      useFactory: (config: MatchingConfig) => {
        const sum = config.weightVector + config.weightExact + config.weightAi;
        if (sum !== 1) {
          throw new Error('Weights must add up to 1');
        }
        return {
          weights: {
            vector: config.weightVector,
            exact: config.weightExact,
            ai: config.weightAi,
          },
          vectorSimilarityThreshold: config.vectorSimilarityThreshold,
          topNCandidates: config.topNCandidates,
          exactMatchThreshold: config.exactMatchThreshold,
          aiMatchThreshold: config.aiMatchThreshold,
          minimumFinalScore: config.minimumFinalScore,
          autoConfirmThreshold: config.autoConfirmThreshold,
          maxSecurityQuestions: config.maxSecurityQuestions,
        };
      },
      inject: [MatchingConfig],
    }),
  ],
  controllers: [DocumentCasesController],
  providers: [
    DocumentEmbeddingProcessor,
    DocumentCasesService,
    DocumentCasesCreateService,
    DocumentCasesQueryService,
    DocumentCasesWorkflowService,
    DocumentCaseGateway,
    DocumentCasesTimelineService,
  ],
})
export class DocumentCasesModule {}

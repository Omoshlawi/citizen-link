import { Module } from '@nestjs/common';
import { DocumentCasesController } from './document-cases.controller';
import { DocumentCasesService } from './document-cases.service';
import { ExtractionModule } from '../extraction/extraction.module';
import { DocumentCaseGateway } from './document-case.gateway';
import { MatchingModule } from '../matching/matching.module';
import { DocumentCasesCreateService } from './document-cases.create.service';
import { DocumentCasesQueryService } from './document-cases.query.service';
import { DocumentCasesWorkflowService } from './documnt-cases.workflow.service';
import { AiModule } from '../ai/ai.module';
import { AiConfig } from '../ai/ai.config';
import { VisionModule } from '../vision/vision.module';
import { MatchingConfig } from '../matching/matching.config';
import { EmbeddingModule } from '../embedding/embedding.module';
import { EmbeddingConfig } from '../embedding/embedding.config';
import { BullModule } from '@nestjs/bullmq';
import { DOCUMENT_EMBEDDING_QUEUE } from './document-cases.constants';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { DocumentEmbeddingProcessor } from './document.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DOCUMENT_EMBEDDING_QUEUE,
      defaultJobOptions: {
        priority: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5_000, // 5s → 10s → 20s
        },
        removeOnComplete: { age: 60 * 60 * 24 }, // keep 24h
        removeOnFail: { age: 60 * 60 * 24 * 7 }, // keep 7d
      },
    }),
    BullBoardModule.forFeature({
      name: DOCUMENT_EMBEDDING_QUEUE,
      adapter: BullMQAdapter,
    }),
    EmbeddingModule.registerAsync({
      useFactory: (config: EmbeddingConfig) => {
        return {
          model: config.model,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          isOpenAi: config.isOpenAi,
        };
      },
      inject: [EmbeddingConfig],
    }),
    AiModule.registerAsync({
      useFactory: (config: AiConfig) => {
        return {
          apiKey: config.openaiApiKey,
          baseURL: config.aiBaseUrl,
          model: config.aiModel || 'gpt-4o', // Default to GPT-4o, can be overridden via env var
        };
      },
      inject: [AiConfig],
    }),
    VisionModule,
    ExtractionModule,
    MatchingModule.registerAsync({
      useFactory: (config: MatchingConfig) => {
        // Ensure weights add up to 1
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
  ],
})
export class DocumentCasesModule {}

import { Module } from '@nestjs/common';
import { CaseStatusTransitionsModule } from '../case-status-transitions/case-status-transitions.module';
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

@Module({
  imports: [
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
    CaseStatusTransitionsModule,
    CaseStatusTransitionsModule,
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
    DocumentCasesService,
    DocumentCasesCreateService,
    DocumentCasesQueryService,
    DocumentCasesWorkflowService,
    DocumentCaseGateway,
  ],
})
export class DocumentCasesModule {}

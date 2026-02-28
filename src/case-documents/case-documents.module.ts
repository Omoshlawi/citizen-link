import { Module } from '@nestjs/common';
import { CaseDocumentsService } from './case-documents.service';
import { CaseDocumentsController } from './case-documents.controller';
import { AiModule } from '../ai/ai.module';
import { AiConfig } from '../ai/ai.config';

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
  ],
  controllers: [CaseDocumentsController],
  providers: [CaseDocumentsService],
})
export class CaseDocumentsModule {}

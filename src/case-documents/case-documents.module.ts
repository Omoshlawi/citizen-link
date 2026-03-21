import { Module } from '@nestjs/common';
import { AiConfig } from '../ai/ai.config';
import { AiModule } from '../ai/ai.module';
import { CaseDocumentsController } from './case-documents.controller';
import { CaseDocumentsService } from './case-documents.service';

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

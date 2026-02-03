import { Module } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { PromptsModule } from 'src/prompts/prompts.module';

@Module({
  imports: [PromptsModule],
  providers: [ExtractionService],
  exports: [ExtractionService],
})
export class ExtractionModule {}

import { Module } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { TemplatesModule } from '../common/templates/templates.module';

@Module({
  imports: [TemplatesModule],
  providers: [PromptsService],
  exports: [PromptsService],
})
export class PromptsModule {}

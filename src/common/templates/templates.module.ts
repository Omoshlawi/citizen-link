import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';

@Module({
  providers: [TemplatesService],
  exports: [TemplatesService], // Must export to make it accessible
})
export class TemplatesModule {}

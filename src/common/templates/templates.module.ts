import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesRenderService } from './templates.render.service';
import { TemplatesVersionsService } from './templates.versions.service';
import { TemplatesController } from './templates.controller';

@Module({
  providers: [
    TemplatesService,
    TemplatesRenderService,
    TemplatesVersionsService,
  ],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}

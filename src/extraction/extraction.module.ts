import { Module } from '@nestjs/common';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';

@Module({
  imports: [],
  providers: [ExtractionService],
  exports: [ExtractionService],
  controllers: [ExtractionController],
})
export class ExtractionModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueryBuilderModule } from '../common/query-builder';
import { CaseStatusTransitionsController } from './case-status-transitions.controller';
import { CaseStatusTransitionsService } from './case-status-transitions.service';

@Module({
  imports: [PrismaModule, QueryBuilderModule],
  controllers: [CaseStatusTransitionsController],
  providers: [CaseStatusTransitionsService],
  exports: [CaseStatusTransitionsService],
})
export class CaseStatusTransitionsModule {}

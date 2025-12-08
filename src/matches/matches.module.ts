import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CaseStatusTransitionsModule } from '../case-status-transitions/case-status-transitions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueryBuilderModule } from '../query-builder';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [
    PrismaModule,
    QueryBuilderModule,
    forwardRef(() => CaseStatusTransitionsModule),
    AiModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}

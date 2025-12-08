import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueryBuilderModule } from '../query-builder';
import { MatchesModule } from '../matches/matches.module';
import { CaseStatusTransitionsController } from './case-status-transitions.controller';
import { CaseStatusTransitionsService } from './case-status-transitions.service';

@Module({
  imports: [
    PrismaModule,
    QueryBuilderModule,
    forwardRef(() => MatchesModule),
  ],
  controllers: [CaseStatusTransitionsController],
  providers: [CaseStatusTransitionsService],
  exports: [CaseStatusTransitionsService],
})
export class CaseStatusTransitionsModule {}

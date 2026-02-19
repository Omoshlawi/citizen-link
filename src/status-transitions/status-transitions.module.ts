import { Module } from '@nestjs/common';
import { StatusTransitionsController } from './status-transitions.controller';
import { TransitionReasonsService } from './status-transitions.reasons.service';
import { StatusTransitionsReasonsController } from './status-transitions.reasons.controller';

@Module({
  controllers: [
    StatusTransitionsController,
    StatusTransitionsReasonsController,
  ],
  providers: [TransitionReasonsService],
})
export class StatusTransitionsModule {}

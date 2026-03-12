import { Module } from '@nestjs/common';
import { StatusTransitionsController } from './status-transitions.controller';
import { TransitionReasonsService } from './status-transitions.reasons.service';
import { StatusTransitionsReasonsController } from './status-transitions.reasons.controller';
import { StatusTransitionService } from './status-transition.service';

@Module({
  controllers: [
    StatusTransitionsController,
    StatusTransitionsReasonsController,
  ],
  providers: [TransitionReasonsService, StatusTransitionService],
})
export class StatusTransitionsModule {}

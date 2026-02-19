import { Module } from '@nestjs/common';
import { StatusTransitionsController } from './status-transitions.controller';
import { StatusTransitionsService } from './status-transitions.service';

@Module({
  controllers: [StatusTransitionsController],
  providers: [StatusTransitionsService]
})
export class StatusTransitionsModule {}

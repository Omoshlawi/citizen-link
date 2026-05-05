import { Module } from '@nestjs/common';
import { PickupStationsController } from './stations.controller';
import { PickupStationsService } from './stations.service';

@Module({
  controllers: [PickupStationsController],
  providers: [PickupStationsService],
})
export class PickupStationsModule {}

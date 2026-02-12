import { Module } from '@nestjs/common';
import { PickupStationsController } from './pickup-stations.controller';
import { PickupStationsService } from './pickup-stations.service';

@Module({
  controllers: [PickupStationsController],
  providers: [PickupStationsService],
})
export class PickupStationsModule {}

import { Module } from '@nestjs/common';
import { StationOperationTypesService } from './station-operation-types.service';
import { StationOperationTypesController } from './station-operation-types.controller';

@Module({
  controllers: [StationOperationTypesController],
  providers: [StationOperationTypesService],
  exports: [StationOperationTypesService],
})
export class StationOperationTypesModule {}

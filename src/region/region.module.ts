import { Global, Module } from '@nestjs/common';
import { RegionController } from './region.controller';
import { RegionService } from './region.service';

@Global()
@Module({
  controllers: [RegionController],
  providers: [RegionService],
  exports: [RegionService],
})
export class RegionModule {}

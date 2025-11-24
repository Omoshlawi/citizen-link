import { Module } from '@nestjs/common';
import { AddressHierarchyService } from './address-hierarchy.service';
import { AddressHierarchyController } from './address-hierarchy.controller';

@Module({
  providers: [AddressHierarchyService],
  controllers: [AddressHierarchyController],
})
export class AddressHierarchyModule {}

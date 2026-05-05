import { Module } from '@nestjs/common';
import { StaffOperationScopeService } from './staff-operation-scope.service';
import { StaffOperationScopeController } from './staff-operation-scope.controller';

@Module({
  controllers: [StaffOperationScopeController],
  providers: [StaffOperationScopeService],
  exports: [StaffOperationScopeService],
})
export class StaffOperationScopeModule {}

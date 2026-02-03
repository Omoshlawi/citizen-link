import { DynamicModule, Module } from '@nestjs/common';
import { PaginationService } from './pagination.service';
import { CustomRepresentationService } from './representation.service';
import { SortService } from './sort.service';

type QueryBuilderModuleOptions = {
  global?: boolean;
};
@Module({})
export class QueryBuilderModule {
  static register(options: QueryBuilderModuleOptions = {}): DynamicModule {
    return {
      global: options.global,
      module: QueryBuilderModule,
      providers: [PaginationService, CustomRepresentationService, SortService],
      exports: [PaginationService, CustomRepresentationService, SortService],
    };
  }
}

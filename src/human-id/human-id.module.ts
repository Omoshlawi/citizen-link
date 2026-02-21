import { DynamicModule, Module } from '@nestjs/common';
import { HumanIdService } from './human-id.service';
import { HumanIdController } from './human-id.controller';
import { HUMAN_ID_OPTIONS } from './human-id.constants';
import {
  HumanIdModuleOptions,
  HumanIdModuleAsyncOptions,
} from './human-id.interface';

@Module({})
export class HumanIdModule {
  static register(
    options: HumanIdModuleOptions & { global?: boolean } = {},
  ): DynamicModule {
    const { global = false, ...moduleOptions } = options;

    return {
      global,
      module: HumanIdModule,
      controllers: [HumanIdController],
      providers: [
        {
          provide: HUMAN_ID_OPTIONS,
          useValue: {
            paddingLength: moduleOptions.paddingLength ?? 6,
          },
        },
        HumanIdService,
      ],
      exports: [HumanIdService],
    };
  }

  static registerAsync(options: HumanIdModuleAsyncOptions): DynamicModule {
    const { global = false, useFactory, inject = [], imports = [] } = options;

    return {
      global,
      module: HumanIdModule,
      imports,
      controllers: [HumanIdController],
      providers: [
        {
          provide: HUMAN_ID_OPTIONS,
          useFactory,
          inject,
        },
        HumanIdService,
      ],
      exports: [HumanIdService],
    };
  }
}

import { DynamicModule, Module } from '@nestjs/common';
import { ExpoSdkController } from './expo-sdk.controller';
import { ExpoSdkService } from './expo-sdk.service';
import { EXPO_NOTIFICATIONS_OPTIONS_TOKEN } from './expo-sdk.constants';
import { ExpoSdkModuleAsyncOptions } from './expo-sdk.interfaces';
import { ExpoClientOptions } from 'expo-server-sdk';

@Module({
  controllers: [ExpoSdkController],
  providers: [ExpoSdkService],
})
export class ExpoSdkModule {
  static register(options: Partial<ExpoClientOptions> = {}): DynamicModule {
    return {
      module: ExpoSdkModule,
      controllers: [ExpoSdkController],
      providers: [
        {
          provide: EXPO_NOTIFICATIONS_OPTIONS_TOKEN,
          useValue: options,
        },
        ExpoSdkService,
      ],
      exports: [ExpoSdkService],
    };
  }

  static registerAsync(options: ExpoSdkModuleAsyncOptions): DynamicModule {
    return {
      global: options.global,
      module: ExpoSdkModule,
      imports: options.imports,
      controllers: [ExpoSdkController],
      providers: [
        {
          provide: EXPO_NOTIFICATIONS_OPTIONS_TOKEN,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        ExpoSdkService,
      ],
      exports: [ExpoSdkService],
    };
  }
}

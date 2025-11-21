import { DynamicModule, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NOTIFICATION_OPTIONS_TOKEN } from './notofication.utils';

export type NotificationModuleOptions = {
  global?: boolean;
  apiKey: string;
  apiSecret: string;
  provider: string;
};

@Module({})
export class NotificationModule {
  static register(options: NotificationModuleOptions): DynamicModule {
    const providers = [
      {
        provide: NOTIFICATION_OPTIONS_TOKEN,
        useValue: options,
      },
    ];
    return {
      global: options.global,
      module: NotificationModule,
      providers: [...providers, NotificationService],
      exports: [NOTIFICATION_OPTIONS_TOKEN, NotificationService],
    };
  }
}

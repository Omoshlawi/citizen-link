/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import {
  NOTIFICATION_OPTIONS_TOKEN,
  NOTIFICATION_QUEUES,
} from './notification.constants';
import {
  EmailProviders,
  NotificationModuleOptions,
  NotificationOptions,
  PushProviders,
  SmsProviders,
} from './notification.interfaces';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import {
  AfricasTalkingProvider,
  ExpoProvider,
  SendGridProvider,
  TwilioProvider,
} from './service-providers';

@Global()
@Module({})
export class NotificationsModule {
  static register(options: NotificationModuleOptions): DynamicModule {
    return {
      global: options.global,
      module: NotificationsModule,
      providers: [
        {
          provide: NOTIFICATION_OPTIONS_TOKEN,
          useValue: options.options,
        },
        ...this.getNotificationProviderClasses(options.options),
        NotificationsService,
      ],
      controllers: [NotificationsController],
      imports: this.registerQueues(),
    };
  }

  private static registerQueues() {
    return [
      // Notifications owns its own queue registrations
      BullModule.registerQueue(
        {
          name: NOTIFICATION_QUEUES.HIGH,
          defaultJobOptions: { priority: 1 },
        },
        {
          name: NOTIFICATION_QUEUES.NORMAL,
          defaultJobOptions: { priority: 5 },
        },
        {
          name: NOTIFICATION_QUEUES.LOW,
          defaultJobOptions: { priority: 10 },
        },
      ),
      // Register queues with Bull Board dashboard
      // BullBoardModule.forRoot() already ran in QueueModule,
      // forFeature() just adds this module's queues to the existing board.
      BullBoardModule.forFeature(
        { name: NOTIFICATION_QUEUES.HIGH, adapter: BullMQAdapter },
        { name: NOTIFICATION_QUEUES.NORMAL, adapter: BullMQAdapter },
        { name: NOTIFICATION_QUEUES.LOW, adapter: BullMQAdapter },
      ),
    ];
  }

  private static getNotificationProviderClasses(options: NotificationOptions) {
    const emailProviderMap: Record<EmailProviders, Type<any>> = {
      [EmailProviders.SENDGRID]: SendGridProvider,
    };
    const smsProviderMap: Record<SmsProviders, Type<any>> = {
      [SmsProviders.TWILIO]: TwilioProvider,
      [SmsProviders.AFRICASTALK]: AfricasTalkingProvider,
    };
    const pushProviderMap: Record<PushProviders, Type<any>> = {
      [PushProviders.EXPO]: ExpoProvider,
    };

    const emailProviderClasses: Array<Provider> = options.emailProviders
      .map((p) => emailProviderMap[p])
      .filter(Boolean);
    const smsProviderClasses: Array<Provider> = options.smsProviders
      .map((p) => smsProviderMap[p])
      .filter(Boolean);
    const pushProviderClasses: Array<Provider> = options.pushProviders
      .map((p) => pushProviderMap[p])
      .filter(Boolean);

    return [
      ...emailProviderClasses,
      ...smsProviderClasses,
      ...pushProviderClasses,
    ];
  }
}

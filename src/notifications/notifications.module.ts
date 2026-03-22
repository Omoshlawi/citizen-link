import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Global, Module, Type } from '@nestjs/common';
import { TemplatesModule } from '../common/templates';
import { EmailDispatcher, PushDispatcher, SmsDispatcher } from './dispatchers';
import {
  NOTIFICATION_OPTIONS_TOKEN,
  NOTIFICATION_QUEUES,
} from './notification.constants';
import {
  EmailProviders,
  IEmailProvider,
  IPushProvider,
  ISmsProvider,
  NotificationModuleOptions,
  NotificationOptions,
  PushProviders,
  SmsProviders,
} from './notification.interfaces';
import {
  NotificationHighProcessor,
  NotificationLowProcessor,
  NotificationNormalProcessor,
} from './notification.processor';
import { NotificationProcessorHandler } from './notification.processor.handler';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import {
  AfricasTalkingProvider,
  ExpoPushProvider,
  TwilioProvider,
} from './service-providers';
import { EmailMailpitProvider } from './service-providers/email.mailpit.provider';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { NotificationConfig } from './notification.config';

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
        ...this.registerProcessors(),
      ],
      controllers: [NotificationsController],
      imports: [
        ...this.registerQueues(),
        TemplatesModule,
        MailerModule.forRootAsync({
          inject: [NotificationConfig],
          useFactory: (config: NotificationConfig) => ({
            transport: {
              host: config.smtpHost,
              port: config.smtpPort,
              // auth: {
              //   user: config.smtpUser,
              //   pass: config.smtpPassword,
              // },
            },
            defaults: {
              from: config.smtpFrom,
              name: config.smtpName,
            },
            template: {
              adapter: new HandlebarsAdapter(),
            },
          }),
        }),
      ],
      exports: [NotificationsService],
    };
  }

  private static registerQueues() {
    return [
      // Notifications owns its own queue registrations
      BullModule.registerQueue(
        {
          name: NOTIFICATION_QUEUES.HIGH,
          defaultJobOptions: {
            priority: 1,
            attempts: 3,
            removeOnComplete: { age: 60 * 60 * 24 },
            removeOnFail: { age: 60 * 60 * 24 * 7 },
          },
        },
        {
          name: NOTIFICATION_QUEUES.NORMAL,
          defaultJobOptions: {
            priority: 5,
            attempts: 3,
            removeOnComplete: { age: 60 * 60 * 24 },
            removeOnFail: { age: 60 * 60 * 24 * 7 },
          },
        },
        {
          name: NOTIFICATION_QUEUES.LOW,
          defaultJobOptions: {
            priority: 10,
            attempts: 3,
            removeOnComplete: { age: 60 * 60 * 24 },
            removeOnFail: { age: 60 * 60 * 24 * 7 },
          },
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

  private static registerProcessors() {
    return [
      NotificationProcessorHandler, // shared logic
      NotificationHighProcessor, // concurrency: 10
      NotificationNormalProcessor, // concurrency: 5
      NotificationLowProcessor, // concurrency: 2
    ];
  }

  private static getNotificationProviderClasses(options: NotificationOptions) {
    const emailProviderMap: Record<EmailProviders, Type<IEmailProvider>> = {
      [EmailProviders.MAILPIT]: EmailMailpitProvider,
    };
    const smsProviderMap: Record<SmsProviders, Type<ISmsProvider>> = {
      [SmsProviders.TWILIO]: TwilioProvider,
      [SmsProviders.AFRICASTALK]: AfricasTalkingProvider,
    };
    const pushProviderMap: Record<PushProviders, Type<IPushProvider>> = {
      [PushProviders.EXPO]: ExpoPushProvider,
    };

    const emailProviderClasses: Array<Type<IEmailProvider>> =
      options.emailProviders.map((p) => emailProviderMap[p]).filter(Boolean);
    const smsProviderClasses: Array<Type<ISmsProvider>> = options.smsProviders
      .map((p) => smsProviderMap[p])
      .filter(Boolean);
    const pushProviderClasses: Array<Type<IPushProvider>> =
      options.pushProviders.map((p) => pushProviderMap[p]).filter(Boolean);

    return [
      ...emailProviderClasses,
      ...smsProviderClasses,
      ...pushProviderClasses,
      {
        provide: EmailDispatcher,
        useFactory: (...p: IEmailProvider[]) => new EmailDispatcher(p),
        inject: emailProviderClasses,
      },
      {
        provide: SmsDispatcher,
        useFactory: (...p: ISmsProvider[]) => new SmsDispatcher(p),
        inject: smsProviderClasses,
      },
      {
        provide: PushDispatcher,
        useFactory: (...p: IPushProvider[]) => new PushDispatcher(p),
        inject: pushProviderClasses,
      },
    ];
  }
}

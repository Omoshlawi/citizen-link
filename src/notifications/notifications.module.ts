import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { TemplatesModule } from '../common/templates';
import { NOTIFICATION_QUEUES } from './notification.constants';
import { NotificationModuleOptions } from './notification.interfaces';
import {
  NotificationHighProcessor,
  NotificationLowProcessor,
  NotificationNormalProcessor,
} from './notification.processor';
import { NotificationProcessorHandler } from './notification.processor.handler';
import { NotificationReceiptProcessor } from './notification.receipt.processor';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchService } from './notifications.dispatch.service';
import { NotificationContentResolver } from './notification.content.resolver';
import { EmailChannelModule } from './channels/email/email.channel.module';
import { SmsChannelModule } from './channels/sms/sms.channel.module';
import { PushChannelModule } from './channels/push/push.channel.module';

@Global()
@Module({})
export class NotificationsModule {
  static register(options: NotificationModuleOptions): DynamicModule {
    return {
      global: options.global,
      module: NotificationsModule,
      imports: [
        EmailChannelModule.register(options.channels.email),
        SmsChannelModule.register(options.channels.sms),
        PushChannelModule.register(options.channels.push),
        ...this.registerQueues(),
        TemplatesModule,
      ],
      providers: [
        NotificationsService,
        NotificationDispatchService,
        NotificationContentResolver,
        NotificationProcessorHandler,
        ...this.registerProcessors(),
        NotificationReceiptProcessor,
      ],
      controllers: [NotificationsController],
      exports: [NotificationDispatchService],
    };
  }

  private static registerQueues() {
    return [
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
        {
          // Delayed receipt-check jobs run ~15 minutes after a successful push send.
          // Keep failed receipts for 7 days to aid debugging; completed ones for 1 day.
          name: NOTIFICATION_QUEUES.PUSH_RECEIPT,
          defaultJobOptions: {
            attempts: 2,
            removeOnComplete: { age: 60 * 60 * 24 },
            removeOnFail: { age: 60 * 60 * 24 * 7 },
          },
        },
      ),
      BullBoardModule.forFeature(
        { name: NOTIFICATION_QUEUES.HIGH, adapter: BullMQAdapter },
        { name: NOTIFICATION_QUEUES.NORMAL, adapter: BullMQAdapter },
        { name: NOTIFICATION_QUEUES.LOW, adapter: BullMQAdapter },
        { name: NOTIFICATION_QUEUES.PUSH_RECEIPT, adapter: BullMQAdapter },
      ),
    ];
  }

  private static registerProcessors() {
    return [
      NotificationHighProcessor, // concurrency: 10
      NotificationNormalProcessor, // concurrency: 5
      NotificationLowProcessor, // concurrency: 2
    ];
  }
}

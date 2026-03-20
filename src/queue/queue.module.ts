import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { QueueConfig } from './queue.config';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [QueueConfig],
      useFactory: (config: QueueConfig) => ({
        connection: {
          url: config.redisDbUrl,
          // Reconnect strategy — important for production
          retryStrategy: (times: number) => Math.min(times * 500, 5000),
          maxRetriesPerRequest: null, // required by BullMQ
        },
        // Default job options applied to ALL queues unless overridden
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5_000, // 5s → 10s → 20s
          },
          removeOnComplete: { age: 60 * 60 * 24 }, // keep 24h
          removeOnFail: { age: 60 * 60 * 24 * 7 }, // keep 7d
        },
      }),
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}

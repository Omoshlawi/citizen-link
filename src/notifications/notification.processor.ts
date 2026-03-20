// Three thin processor classes, all delegating to one shared service

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUES } from './notification.constants';
import { NotificationProcessorHandler } from './notification.processor.handler';
import { Job } from 'bullmq';
import { NotificationJob } from './notification.interfaces';
import { Logger } from '@nestjs/common';

@Processor(NOTIFICATION_QUEUES.HIGH, { concurrency: 10 })
export class NotificationHighProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationHighProcessor.name);
  constructor(private readonly handler: NotificationProcessorHandler) {
    super();
  }
  async process(job: Job<NotificationJob>) {
    return this.handler.process(job);
  }
  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationJob>, err: Error) {
    this.logger.error(`Job failed: ${job.id}`, err);
    await this.handler.onFailed(job, err);
  }
}

@Processor(NOTIFICATION_QUEUES.NORMAL, { concurrency: 5 })
export class NotificationNormalProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationNormalProcessor.name);
  constructor(private readonly handler: NotificationProcessorHandler) {
    super();
  }
  async process(job: Job<NotificationJob>) {
    this.logger.log(`Processing job: ${job.id}`);
    return this.handler.process(job);
  }
  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationJob>, err: Error) {
    this.logger.error(`Job failed: ${job.id}`, err);
    await this.handler.onFailed(job, err);
  }
}

@Processor(NOTIFICATION_QUEUES.LOW, { concurrency: 2 })
export class NotificationLowProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationLowProcessor.name);
  constructor(private readonly handler: NotificationProcessorHandler) {
    super();
  }
  async process(job: Job<NotificationJob>) {
    this.logger.log(`Processing job: ${job.id}`);
    return this.handler.process(job);
  }
  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationJob>, err: Error) {
    this.logger.error(`Job failed: ${job.id}`, err);
    await this.handler.onFailed(job, err);
  }
}

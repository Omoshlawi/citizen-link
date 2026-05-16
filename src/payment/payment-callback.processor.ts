import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PAYMENT_CALLBACKS_QUEUE } from './payment.constants';
import { PaymentCallbackJob } from './payment-callback.interfaces';
import { TransactionService } from './transaction.service';

@Processor(PAYMENT_CALLBACKS_QUEUE, { concurrency: 5 })
export class PaymentCallbackProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentCallbackProcessor.name);

  constructor(private readonly transactionService: TransactionService) {
    super();
  }

  process(job: Job<PaymentCallbackJob>): Promise<void> {
    return this.transactionService.handlePaymentCallback(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PaymentCallbackJob>, error: Error) {
    this.logger.error(
      `Payment callback job ${job.id} (${job.data.provider}:${job.data.correlationId}) failed: ${error.message}`,
      error.stack,
    );
  }
}

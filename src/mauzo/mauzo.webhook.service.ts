import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WebHookDto, WebHookEvents } from './mauzo.dto';
import {
  PaymentCallbackJob,
  PaymentCallbackProvider,
} from '../payment/payment-callback.interfaces';
import { PAYMENT_CALLBACKS_QUEUE } from '../payment/payment.constants';

@Injectable()
export class MauzoWebHookService {
  constructor(
    @InjectQueue(PAYMENT_CALLBACKS_QUEUE)
    private readonly callbacksQueue: Queue<PaymentCallbackJob>,
  ) {}

  async onPaymentEvent(dto: WebHookDto): Promise<void> {
    const success = dto.event === WebHookEvents.PAYMENT_SUCCEDED;

    const job: PaymentCallbackJob = {
      provider: PaymentCallbackProvider.MAUZO,
      correlationId: dto.data.payment.provider_data.checkoutRequestId,
      success,
      receiptNumber: success
        ? dto.data.payment.provider_data.mpesaReceiptNumber
        : undefined,
      amount: dto.data.amount,
      errorMessage: success ? undefined : dto.event,
      raw: dto,
    };

    await this.callbacksQueue.add('mauzo-event', job);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { DarajaService } from './daraja.service';
import { StkCallbackBodyDto } from './daraja.dto';
import {
  PaymentCallbackJob,
  PaymentCallbackProvider,
} from '../payment/payment-callback.interfaces';
import { PAYMENT_CALLBACKS_QUEUE } from '../payment/payment.constants';

@Controller('daraja')
export class DarajaController {
  constructor(
    private readonly darajaService: DarajaService,
    @InjectQueue(PAYMENT_CALLBACKS_QUEUE)
    private readonly callbacksQueue: Queue<PaymentCallbackJob>,
  ) {}

  /**
   * Safaricom STK push result callback — unauthenticated (IP-whitelisted by Safaricom).
   * Returns 200 immediately so Daraja does not retry.
   */
  @Post('callback/stk')
  @AllowAnonymous()
  async stkCallback(@Body() body: StkCallbackBodyDto) {
    const { CheckoutRequestID, ResultCode, ResultDesc } = body.Body.stkCallback;

    const success = ResultCode === 0;

    const job: PaymentCallbackJob = {
      provider: PaymentCallbackProvider.MPESA,
      correlationId: CheckoutRequestID,
      success,
      receiptNumber: success
        ? (this.darajaService.extractReceiptNumber(body) ?? undefined)
        : undefined,
      errorCode: ResultCode,
      errorMessage: ResultDesc,
      raw: body,
    };

    await this.callbacksQueue.add('stk-callback', job);

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}

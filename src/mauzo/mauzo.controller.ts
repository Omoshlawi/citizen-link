import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { MauzoWebHookService } from './mauzo.webhook.service';
import { MauzoWebhookSignatureGuard } from './mauzo.guard';
import { WebHookDto } from './mauzo.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('mauzo')
export class MauzoController {
  constructor(private readonly mauzoWebhookService: MauzoWebHookService) {}

  @AllowAnonymous()
  @UseGuards(MauzoWebhookSignatureGuard)
  @Post('event')
  onPaymentEvent(@Body() paymentEventDto: WebHookDto) {
    return this.mauzoWebhookService.onPaymentEvent(paymentEventDto);
  }
}

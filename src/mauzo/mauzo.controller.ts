import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { MauzoWebHookService } from './mauzo.webhook.service';
import { MauzoWebhookSignatureGuard } from './mauzo.guard';
import { WebHookDto } from './mauzo.dto';

@Controller('mauzo')
export class MauzoController {
  constructor(private readonly mauzoWebhookService: MauzoWebHookService) {}

  @UseGuards(MauzoWebhookSignatureGuard)
  @Post('event')
  onPaymentEvent(@Body() paymentEventDto: WebHookDto) {
    return this.mauzoWebhookService.onPaymentEvent(paymentEventDto);
  }
}

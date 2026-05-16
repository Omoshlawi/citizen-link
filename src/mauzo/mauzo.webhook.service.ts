import { Injectable } from '@nestjs/common';
import { WebHookDto } from './mauzo.dto';

@Injectable()
export class MauzoWebHookService {
  async onPaymentEvent(dto: WebHookDto) {
  
  }
}

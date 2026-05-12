import { Injectable, OnModuleInit } from '@nestjs/common';
import { MauzoConfig } from './mauzo.config';
import { HttpService } from '@nestjs/axios';
import { PaymentintentDto, PaymentIntentResponseDto } from './mauzo.dto';
import { HumanIdService } from 'src/human-id/human-id.service';
import { EntityPrefix } from 'src/human-id/human-id.constants';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class MauzoService implements OnModuleInit {
  constructor(
    private readonly config: MauzoConfig,
    private readonly httpService: HttpService,
    private readonly humanIdService: HumanIdService,
  ) {}
  onModuleInit() {
    this.httpService.axiosRef.interceptors.request.use((conf) => {
      conf.headers.Authorization = `Bearer ${this.config.secreteKey}`;
      conf.headers['Content-Type'] = 'application/json';
      return conf;
    });
  }

  private async getIdempotencyKey() {
    const key = await this.humanIdService.generate({
      prefix: EntityPrefix.MAUZO_PAYMENT_INTENT,
    });

    return key;
  }

  async initiatePayment(dto: PaymentintentDto) {
    const key = await this.getIdempotencyKey();
    const res = await lastValueFrom(
      this.httpService.post<PaymentIntentResponseDto>('/payment_intents', dto, {
        headers: {
          'Idempotency-Key': key,
        },
      }),
    );
    return res.data;
  }
}

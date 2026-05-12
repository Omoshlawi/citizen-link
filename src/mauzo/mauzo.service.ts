import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import { EntityPrefix } from 'src/human-id/human-id.constants';
import { HumanIdService } from 'src/human-id/human-id.service';
import { MauzoConfig } from './mauzo.config';
import {
  ErrorResponseDto,
  ErrorTypes,
  GetWalletBalanceDto,
  PaymentintentDto,
  PaymentIntentResponseDto,
} from './mauzo.dto';

@Injectable()
export class MauzoService implements OnModuleInit {
  private readonly logger = new Logger(MauzoService.name);
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

  async initiatePayment(
    dto: PaymentintentDto,
  ): Promise<PaymentIntentResponseDto> {
    try {
      const key = await this.getIdempotencyKey();
      const res = await lastValueFrom(
        this.httpService.post<PaymentIntentResponseDto>(
          '/payment_intents',
          dto,
          {
            headers: {
              'Idempotency-Key': key,
            },
          },
        ),
      );

      return res.data; // res.data is now correctly typed as PaymentIntentResponseDto
    } catch (err) {
      // FIX: Type safe error handling for Axios responses
      if (err instanceof AxiosError && err.response) {
        // Cast the backend error body to your ErrorResponseDto
        const errorData = err.response.data as ErrorResponseDto;
        if (errorData.type === ErrorTypes.RATE_LIMIT_ERROR) {
          // await sleep(errorData.retryAfter * 1000);
          // return createPayment(data);
          this.logger.error(errorData.type, errorData.message); // TODO: properly log
          throw new HttpException(
            errorData.message,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (errorData.type === ErrorTypes.INVALID_REQUEST_ERROR) {
          this.logger.error(errorData.type, errorData.message); // TODO: properly log
          // throw new ValidationError(errorData.param);
          throw new BadRequestException(errorData.message);
        }
        if (errorData.type === ErrorTypes.API_ERROR) {
          this.logger.error(errorData.type, errorData.message); // TODO: properly log
          // return retryWithBackoff(() => createPayment(data));
          throw new InternalServerErrorException();
        }
      }

      throw new InternalServerErrorException();
    }
  }

  getBalance() {
    return lastValueFrom(
      this.httpService.get<GetWalletBalanceDto>('/wallet/balance'),
    );
  }
}

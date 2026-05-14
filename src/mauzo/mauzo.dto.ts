import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const PaymentIntentSchema = z.object({
  amount: z.number().min(1),
  currency: z.string(),
  phone_number: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()),
});

export enum WebHookEvents {
  PAYMENT_SUCCEDED = 'payment.succeeded',
  PAYMENT_FIAILED = 'payment.failed',
  PAYMENT_PROCESSING = 'payment.processing',
}

export enum PaymentStatus {
  SUCCEEDED = 'SUCCEEDED',
}

export enum PaymentProviders {
  MPESA = 'MPESA',
}

export const WebHookSchema = z.object({
  event: z.enum(WebHookEvents),
  api_version: z.string(),
  created: z.number(),
  data: z.object({
    id: z.string(),
    amount: z.number(),
    currency: z.string(),
    status: z.enum(PaymentStatus),
    payments: z.object({
      provider: z.enum(PaymentProviders),
      provider_ref: z.string(),
      status: z.enum(PaymentStatus),
    }),
  }),
});

export class PaymentintentDto extends createZodDto(PaymentIntentSchema) {}
export class WebHookDto extends createZodDto(WebHookSchema) {}

enum PaymentIntentStatus {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FALED',
  CANCELED = 'CANCELED',
}

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;
  @ApiProperty({ enum: PaymentProviders })
  provider!: PaymentProviders;
  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;
}

export class PaymentIntentMetadata {
  @ApiProperty()
  invoiceId: string;
  @ApiProperty()
  invoiceNumber: string;
}

export class PaymentIntentResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;
  @ApiProperty({ type: 'string', example: 'payment_intent' })
  object: string;
  @ApiProperty()
  amount!: number;
  @ApiProperty()
  currency!: string;
  @ApiProperty({ enum: PaymentIntentStatus })
  status!: PaymentIntentStatus;
  @ApiProperty()
  short_code!: string;
  @ApiProperty()
  description!: string;
  @ApiProperty({ isArray: true, type: PaymentResponseDto })
  payments!: Array<PaymentResponseDto>;
  @ApiProperty({ nullable: true, required: false })
  failure_reason?: string;
  @ApiProperty({ type: PaymentIntentMetadata })
  metadata: PaymentIntentMetadata;
  @ApiProperty({ required: false, nullable: true })
  customerId?: string;
  @ApiProperty()
  created!: number;
  @ApiProperty()
  updated!: number;
}

export class GetWalletBalanceDto {
  @ApiProperty()
  balance!: number;
  @ApiProperty()
  currency!: string;
  @ApiProperty()
  available!: number;
  @ApiProperty()
  pending!: number;
  @ApiProperty()
  lastUpdated!: string;
}

export enum ErrorTypes {
  INVALID_REQUEST_ERROR = 'invalid_request_error',
  UNAUTHORIZED_REQUEST_ERROR = 'authentication_error',
  CARD_ERROR = 'card_error',
  CONFLICT_ERROR = 'conflict_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  API_ERROR = 'api_error',
}
export class ErrorPayloadDto {
  @ApiProperty()
  message!: string;
  @ApiProperty()
  error!: string;
  @ApiProperty({ enum: ErrorTypes })
  type!: ErrorTypes;
  @ApiProperty({ example: 'phone_number' })
  param!: string;
}
export class ErrorResponseDto extends ErrorPayloadDto {
  // @ApiProperty({ type: ErrorPayloadDto })
  // error: ErrorPayloadDto;
}

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
    object: z.string().optional().nullable(),
    status: z.enum(PaymentStatus),
    payment: z.object({
      id: z.string(),
      provider: z.enum(PaymentProviders),
      provider_ref: z.string(),
      provider_data: z.object({
        isSandbox: z.boolean().optional().default(true),
        phoneNumber: z.string(),
        callbackData: z.object({
          Source: z.string().optional().nullable(),
          ResultCode: z.number(),
          ResultDesc: z.string().optional().nullable(),
        }),
        checkoutRequestId: z.string(),
        mpesaReceiptNumber: z.string(),
      }),
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
  @ApiProperty()
  provider_ref: string;
}

export class PaymentIntentMetadata {
  @ApiProperty()
  invoiceId: string;
  @ApiProperty()
  invoiceNumber: string;
}

/**
 * {
  id: 'TXS3ZPRWDQ',
  object: 'payment_intent',
  amount: 600,
  currency: 'KES',
  status: 'processing',
  description: 'Payment for invoice INV-TEZV1B-000008',
  failure_reason: null,
  short_code: 'X4Y0A',
  metadata: {
    invoiceId: '49a952e6-c5db-4efc-a03b-83c5f76983b5',
    invoiceNumber: 'INV-TEZV1B-000008'
  },
  customer_id: null,
  public_key: 'pk_2a9a54591f1829cddf61bf84',
  created: 1778709139,
  updated: 1778709139,
  latest_payment: {
    id: 'MP5XS28FLH',
    provider: 'mpesa',
    provider_ref: 'ws_CO_14052026005222767793889658',
    status: 'pending'
  }
}
 */

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
  @ApiProperty({ nullable: true, required: false })
  failure_reason?: string;
  @ApiProperty({ type: PaymentResponseDto })
  latest_payment: PaymentResponseDto;
  @ApiProperty({ type: PaymentIntentMetadata })
  metadata: PaymentIntentMetadata;
  @ApiProperty({ required: false, nullable: true })
  customer_id?: string;
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

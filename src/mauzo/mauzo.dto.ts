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

export class PaymentintentDto extends createZodDto(PaymentIntentSchema) {}

enum PaymentIntentStatus {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FALED',
  CANCELED = 'CANCELED',
}

export class PaymentResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  provider: string;
  @ApiProperty({ enum: PaymentIntentStatus })
  status: PaymentIntentStatus;
}

export class PaymentIntentResponseDto {
  @ApiProperty({ type: 'string' })
  id: string;
  @ApiProperty()
  amount: number;
  @ApiProperty()
  currency: string;
  @ApiProperty({ enum: PaymentIntentStatus })
  status: PaymentIntentStatus;
  @ApiProperty()
  short_code: string;
  @ApiProperty()
  description: string;
  @ApiProperty({ nullable: true, required: false })
  failure_reason: string;
  @ApiProperty({ isArray: true, type: PaymentResponseDto })
  payments: Array<PaymentResponseDto>;
  @ApiProperty()
  createdAt: Date;
}

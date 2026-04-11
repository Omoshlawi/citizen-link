import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import {
  Disbursement,
  DisbursementStatus,
  PaymentMethod,
  PaymentProvider,
} from '../../generated/prisma/client';

export const WithdrawDisbursementSchema = z.object({
  /** E.164 phone number for B2C payout. Defaults to the finder's phone number on file. */
  phoneNumber: z
    .string()
    .regex(/^254\d{9}$/, 'Phone number must be in format 2547XXXXXXXX')
    .optional(),
});

export const QueryDisbursementSchema = z.object({
  ...QueryBuilderSchema.shape,
  status: z.enum(DisbursementStatus).optional(),
  /** Admin only — filter by recipient */
  recipientId: z.uuid().optional(),
  createdAtFrom: z.iso.date().optional(),
  createdAtTo: z.iso.date().optional(),
});

export class WithdrawDisbursementDto extends createZodDto(
  WithdrawDisbursementSchema,
) {}
export class QueryDisbursementDto extends createZodDto(
  QueryDisbursementSchema,
) {}

export class GetDisbursementResponseDto implements Disbursement {
  @ApiProperty() id: string;
  @ApiProperty() disbursementNumber: string;
  @ApiProperty() invoiceId: string;
  @ApiProperty() recipientId: string;
  @ApiProperty() amount: any;
  @ApiProperty() currency: string;
  @ApiProperty({ enum: PaymentMethod }) paymentMethod: PaymentMethod;
  @ApiProperty({ enum: PaymentProvider, required: false })
  paymentProvider: PaymentProvider | null;
  @ApiProperty({ required: false }) providerTransactionId: string | null;
  @ApiProperty({ enum: DisbursementStatus }) status: DisbursementStatus;
  @ApiProperty({ required: false }) metadata: any;
  @ApiProperty({ required: false }) initiatedAt: Date | null;
  @ApiProperty({ required: false }) completedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class QueryDisbursementResponseDto {
  @ApiProperty({ isArray: true, type: GetDisbursementResponseDto })
  results: GetDisbursementResponseDto[];
  @ApiProperty() totalCount: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() currentPage: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() next: string | null;
  @ApiProperty() prev: string | null;
}

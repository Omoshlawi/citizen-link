import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import {
  Transaction,
  TransactionStatus,
  PaymentMethod,
  PaymentProvider,
} from '../../generated/prisma/client';

export const InitiatePaymentSchema = z.object({
  invoiceId: z.uuid(),
  /** E.164 phone number for STK push, e.g. 254712345678. Defaults to the authenticated user's phone number. */
  phoneNumber: z
    .string()
    .regex(/^254\d{9}$/, 'Phone number must be in format 2547XXXXXXXX')
    .optional(),
  /** Partial amount for installment. Defaults to full balanceDue. */
  amount: z.number().positive().optional(),
});

export const QueryTransactionSchema = z.object({
  ...QueryBuilderSchema.shape,
  invoiceId: z.uuid().optional(),
  userId: z.uuid().optional().describe('Admin only'),
  status: z.enum(TransactionStatus).optional(),
  paymentProvider: z.enum(PaymentProvider).optional(),
  createdAtFrom: z.iso.date().optional(),
  createdAtTo: z.iso.date().optional(),
});

export class InitiatePaymentDto extends createZodDto(InitiatePaymentSchema) {}
export class QueryTransactionDto extends createZodDto(QueryTransactionSchema) {}

export class GetTransactionResponseDto implements Transaction {
  @ApiProperty() id: string;
  @ApiProperty() transactionNumber: string;
  @ApiProperty() userId: string;
  @ApiProperty({ required: false }) initiatedById: string | null;
  @ApiProperty() invoiceId: string;
  @ApiProperty() amount: any;
  @ApiProperty() currency: string;
  @ApiProperty({ enum: PaymentMethod }) paymentMethod: PaymentMethod;
  @ApiProperty({ enum: PaymentProvider, required: false })
  paymentProvider: PaymentProvider | null;
  @ApiProperty({ required: false }) providerTransactionId: string | null;
  @ApiProperty({ required: false }) checkoutRequestId: string | null;
  @ApiProperty({ enum: TransactionStatus }) status: TransactionStatus;
  @ApiProperty({ required: false }) metadata: any;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class QueryTransactionResponseDto {
  @ApiProperty({ isArray: true, type: GetTransactionResponseDto })
  results: GetTransactionResponseDto[];
  @ApiProperty() totalCount: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() currentPage: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() next: string | null;
  @ApiProperty() prev: string | null;
}

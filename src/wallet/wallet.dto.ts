import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentProvider,
  WalletEntryReason,
  WalletEntryType,
  WalletWithdrawalStatus,
} from '../../generated/prisma/client';
import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';

export const QueryWalletLedgerSchema = z.object({
  ...QueryBuilderSchema.shape,
  type: z.enum(WalletEntryType).optional(),
  reason: z.enum(WalletEntryReason).optional(),
  /** Admin only — view another user's wallet */
  userId: z.string().optional(),
  createdAtFrom: z.iso.date().optional(),
  createdAtTo: z.iso.date().optional(),
});

export class QueryWalletLedgerDto extends createZodDto(
  QueryWalletLedgerSchema,
) {}

export const WithdrawFromWalletSchema = z.object({
  /** Amount to withdraw — must be positive and ≤ wallet balance */
  amount: z.number().positive('Amount must be positive'),
  /**
   * Subscriber digits as typed (e.g. 712345678).
   * Accepts any regional format — normalized to Daraja format by RegionService.toDarajaPhone().
   * Defaults to the user's registered phone number when omitted.
   */
  phoneNumber: z.string().min(1, 'Phone number is required').optional(),
});

export const QueryWalletWithdrawalSchema = z.object({
  ...QueryBuilderSchema.shape,
  status: z.enum(WalletWithdrawalStatus).optional(),
  /** Admin only */
  userId: z.string().optional(),
  createdAtFrom: z.iso.date().optional(),
  createdAtTo: z.iso.date().optional(),
});

export class WithdrawFromWalletDto extends createZodDto(
  WithdrawFromWalletSchema,
) {}
export class QueryWalletWithdrawalDto extends createZodDto(
  QueryWalletWithdrawalSchema,
) {}

export class WalletLedgerEntryDto {
  @ApiProperty() id: string;
  @ApiProperty() walletId: string;
  @ApiProperty({ enum: WalletEntryType }) type: WalletEntryType;
  @ApiProperty({ enum: WalletEntryReason }) reason: WalletEntryReason;
  @ApiProperty() amount: any;
  @ApiProperty() balanceBefore: any;
  @ApiProperty() balanceAfter: any;
  @ApiProperty({ required: false }) referenceType: string | null;
  @ApiProperty({ required: false }) referenceId: string | null;
  @ApiProperty({ required: false }) description: string | null;
  @ApiProperty() createdAt: Date;
}

export class GetWalletResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() balance: any;
  @ApiProperty() currency: string;
  @ApiProperty() updatedAt: Date;
}

export class QueryWalletLedgerResponseDto {
  @ApiProperty({ isArray: true, type: WalletLedgerEntryDto })
  results: WalletLedgerEntryDto[];
  @ApiProperty() totalCount: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() currentPage: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() next: string | null;
  @ApiProperty() prev: string | null;
}

export class WalletWithdrawalDto {
  @ApiProperty() id: string;
  @ApiProperty() withdrawalNumber: string;
  @ApiProperty() amount: any;
  @ApiProperty() currency: string;
  @ApiProperty() phoneNumber: string;
  @ApiProperty({ enum: WalletWithdrawalStatus }) status: WalletWithdrawalStatus;
  @ApiProperty({ enum: PaymentProvider }) paymentProvider: PaymentProvider;
  @ApiProperty({ required: false }) providerTransactionId: string | null;
  @ApiProperty({ required: false }) completedAt: Date | null;
  @ApiProperty({ required: false }) failedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class QueryWalletWithdrawalResponseDto {
  @ApiProperty({ isArray: true, type: WalletWithdrawalDto })
  results: WalletWithdrawalDto[];
  @ApiProperty() totalCount: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() currentPage: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() next: string | null;
  @ApiProperty() prev: string | null;
}

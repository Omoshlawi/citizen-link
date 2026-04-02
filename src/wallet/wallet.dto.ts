import { ApiProperty } from '@nestjs/swagger';
import {
  WalletEntryReason,
  WalletEntryType,
} from '../../generated/prisma/client';
import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';

export const QueryWalletLedgerSchema = z.object({
  ...QueryBuilderSchema.shape,
  type: z.enum(WalletEntryType).optional(),
  reason: z.enum(WalletEntryReason).optional(),
  /** Admin only — view another user's wallet */
  userId: z.uuid().optional(),
  createdAtFrom: z.iso.date().optional(),
  createdAtTo: z.iso.date().optional(),
});

export class QueryWalletLedgerDto extends createZodDto(
  QueryWalletLedgerSchema,
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

import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const QueryDisbursementSchema = z.object({
  ...QueryBuilderSchema.shape,
  /** Admin only — filter by recipient */
  recipientId: z.uuid().optional(),
  createdAtFrom: z.iso.date().optional(),
  createdAtTo: z.iso.date().optional(),
});

export class QueryDisbursementDto extends createZodDto(
  QueryDisbursementSchema,
) {}

export class GetDisbursementResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() disbursementNumber: string;
  @ApiProperty() invoiceId: string;
  @ApiProperty() recipientId: string;
  @ApiProperty() amount: any;
  @ApiProperty() currency: string;
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

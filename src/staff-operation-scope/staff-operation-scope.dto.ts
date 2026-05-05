import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { QueryDocumentOperationTypesSchema } from 'src/document-operation-types/document-operation-types.dto';
import z from 'zod';
import { StaffStationOperation } from '../../generated/prisma/client';
import { PaginatedListBase, QueryBuilderSchema } from '../common/query-builder';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const CreateStaffOperationScopeSchema = z.object({
  userId: z.string().nonempty(),
  stationId: z.uuid(),
  operationTypeIds: z.array(z.uuid()).min(1),
});

export const QueryStaffOperationsScopeSchema = z
  .object({
    ...QueryBuilderSchema.shape,
    userId: z
      .string()
      .optional()
      .describe('Admin only - query operations for user with supplied id'),
    stationId: z.uuid().optional(),
    operationTypeId: z.uuid().optional(),
    includeVoided: z
      .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
      .optional()
      .default(false),
  })
  .extend(QueryDocumentOperationTypesSchema.shape);

// ── DTOs ─────────────────────────────────────────────────────────────────────

export class CreateStaffOperationScopeDto extends createZodDto(
  CreateStaffOperationScopeSchema,
) {}
export class QueryStaffOperationsScopeDto extends createZodDto(
  QueryStaffOperationsScopeSchema,
) {}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class GetStaffOperationScoperResponseDto
  implements StaffStationOperation
{
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() stationId!: string;
  @ApiProperty() operationTypeId!: string;
  @ApiProperty() grantedById!: string;
  @ApiProperty() voided!: boolean;
  @ApiPropertyOptional({ nullable: true }) voidedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) voidedById!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class GetStaffOperationsScoperListDto extends PaginatedListBase {
  @ApiProperty({ type: [GetStaffOperationScoperResponseDto] })
  results!: GetStaffOperationScoperResponseDto[];
}

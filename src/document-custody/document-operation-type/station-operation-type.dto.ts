import { createZodDto } from 'nestjs-zod';
import { PaginatedListBase, QueryBuilderSchema } from '../../common/query-builder';
import z from 'zod';
import { StationOperationType } from '../../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const CreateStationOperationTypeSchema = z.object({
  operationTypeId: z.uuid(),
  isEnabled: z.boolean().default(true),
});

export const UpdateStationOperationTypeSchema = z.object({
  isEnabled: z.boolean(),
});

export const QueryStationOperationTypesSchema = z.object({
  ...QueryBuilderSchema.shape,
  includeVoided: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional()
    .default(false),
});

// ── DTOs ─────────────────────────────────────────────────────────────────────

export class CreateStationOperationTypeDto extends createZodDto(
  CreateStationOperationTypeSchema,
) {}
export class UpdateStationOperationTypeDto extends createZodDto(
  UpdateStationOperationTypeSchema,
) {}
export class QueryStationOperationTypesDto extends createZodDto(
  QueryStationOperationTypesSchema,
) {}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class GetStationOperationTypeResponseDto implements StationOperationType {
  @ApiProperty() id!: string;
  @ApiProperty() stationId!: string;
  @ApiProperty() operationTypeId!: string;
  @ApiProperty() isEnabled!: boolean;
  @ApiProperty() voided!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class GetStationOperationTypesListDto extends PaginatedListBase {
  @ApiProperty({ type: [GetStationOperationTypeResponseDto] })
  results!: GetStationOperationTypeResponseDto[];
}

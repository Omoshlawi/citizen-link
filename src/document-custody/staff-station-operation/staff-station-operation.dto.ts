import { createZodDto } from 'nestjs-zod';
import { PaginatedListBase, QueryBuilderSchema } from '../../common/query-builder';
import z from 'zod';
import { StaffStationOperation } from '../../../generated/prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const CreateStaffStationOperationSchema = z.object({
  userId: z.string().nonempty(),
  stationId: z.uuid(),
  operationTypeIds: z.array(z.uuid()).min(1),
});

export const QueryStaffStationOperationsSchema = z.object({
  ...QueryBuilderSchema.shape,
  userId: z.uuid().optional(),
  stationId: z.uuid().optional(),
  operationTypeId: z.uuid().optional(),
  includeVoided: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional()
    .default(false),
});

// ── DTOs ─────────────────────────────────────────────────────────────────────

export class CreateStaffStationOperationDto extends createZodDto(
  CreateStaffStationOperationSchema,
) {}
export class QueryStaffStationOperationsDto extends createZodDto(
  QueryStaffStationOperationsSchema,
) {}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class GetStaffStationOperationResponseDto implements StaffStationOperation {
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

export class GetStaffStationOperationsListDto extends PaginatedListBase {
  @ApiProperty({ type: [GetStaffStationOperationResponseDto] })
  results!: GetStaffStationOperationResponseDto[];
}

// ── My Stations ───────────────────────────────────────────────────────────────

export class MyStationOperationDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class MyStationDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() level1!: string;
  @ApiPropertyOptional({ nullable: true }) level2!: string | null;
  @ApiProperty({ type: MyStationOperationDto, isArray: true }) operations!: MyStationOperationDto[];
}

export class GetMyStationsResponseDto {
  @ApiProperty({ type: [MyStationDto] }) results!: MyStationDto[];
  @ApiProperty() totalCount!: number;
}

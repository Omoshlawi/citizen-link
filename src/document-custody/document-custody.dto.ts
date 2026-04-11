import { createZodDto } from 'nestjs-zod';
import { PaginatedListBase, QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import {
  CustodyStatus,
  DocumentOperation,
  DocumentOperationType,
  StaffStationOperation,
  StationOperationType,
} from '../../generated/prisma/client';
import { JsonValue } from '@prisma/client/runtime/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

//  Custody Operation DTOs

export const RecordReceivedSchema = z.object({
  stationId: z.uuid(),
  notes: z.string().optional(),
});

export const InitiateTransferSchema = z.object({
  toStationId: z.uuid(),
  notes: z.string().optional(),
});

export const ConfirmTransferSchema = z.object({
  pairedOperationId: z.uuid(),
  notes: z.string().optional(),
});

export const CreateRequisitionSchema = z.object({
  requestingStationId: z.uuid(),
  notes: z.string().optional(),
});

export const RecordHandoverSchema = z.object({
  stationId: z.uuid(),
  notes: z.string().optional(),
});

export const RecordDisposalSchema = z.object({
  stationId: z.uuid(),
  notes: z.string().min(1, 'Notes are required for disposal'),
});

export const RecordReturnSchema = z.object({
  stationId: z.uuid(),
  notes: z.string().optional(),
});

export const RecordAuditSchema = z.object({
  stationId: z.uuid(),
  notes: z.string().optional(),
});

export const RecordConditionUpdateSchema = z.object({
  stationId: z.uuid(),
  notes: z.string().min(1, 'Notes are required for condition updates'),
  metadata: z.record(z.string(), z.any()).optional(),
});

export class RecordReceivedDto extends createZodDto(RecordReceivedSchema) {}
export class InitiateTransferDto extends createZodDto(InitiateTransferSchema) {}
export class ConfirmTransferDto extends createZodDto(ConfirmTransferSchema) {}
export class CreateRequisitionDto extends createZodDto(
  CreateRequisitionSchema,
) {}
export class RecordHandoverDto extends createZodDto(RecordHandoverSchema) {}
export class RecordDisposalDto extends createZodDto(RecordDisposalSchema) {}
export class RecordReturnDto extends createZodDto(RecordReturnSchema) {}
export class RecordAuditDto extends createZodDto(RecordAuditSchema) {}
export class RecordConditionUpdateDto extends createZodDto(
  RecordConditionUpdateSchema,
) {}

//  Query DTOs

export const QueryDocumentOperationsSchema = z.object({
  ...QueryBuilderSchema.shape,
  foundCaseId: z.uuid().optional(),
  operationTypeId: z.uuid().optional(),
  stationId: z.uuid().optional(),
  performedById: z.uuid().optional(),
});

export class QueryDocumentOperationsDto extends createZodDto(
  QueryDocumentOperationsSchema,
) {}

//  DocumentOperationType DTOs ──

export const CreateDocumentOperationTypeSchema = z.object({
  code: z.string().min(1),
  prefix: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  requiresDestinationStation: z.boolean().default(false),
  requiresSourceStation: z.boolean().default(false),
  requiresNotes: z.boolean().default(false),
  isHighPrivilege: z.boolean().default(false),
  isFinalOperation: z.boolean().default(false),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const UpdateDocumentOperationTypeSchema =
  CreateDocumentOperationTypeSchema.partial();

export const QueryDocumentOperationTypesSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z.string().optional(),
  includeVoided: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional()
    .default(false),
});

export class CreateDocumentOperationTypeDto extends createZodDto(
  CreateDocumentOperationTypeSchema,
) {}
export class UpdateDocumentOperationTypeDto extends createZodDto(
  UpdateDocumentOperationTypeSchema,
) {}
export class QueryDocumentOperationTypesDto extends createZodDto(
  QueryDocumentOperationTypesSchema,
) {}

//  StationOperationType DTOs

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

export class CreateStationOperationTypeDto extends createZodDto(
  CreateStationOperationTypeSchema,
) {}
export class UpdateStationOperationTypeDto extends createZodDto(
  UpdateStationOperationTypeSchema,
) {}
export class QueryStationOperationTypesDto extends createZodDto(
  QueryStationOperationTypesSchema,
) {}

//  StaffStationOperation DTOs

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

export class CreateStaffStationOperationDto extends createZodDto(
  CreateStaffStationOperationSchema,
) {}
export class QueryStaffStationOperationsDto extends createZodDto(
  QueryStaffStationOperationsSchema,
) {}

// Response DTOs

export class GetDocumentOperationResponseDto implements DocumentOperation {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  operationNumber!: string;
  @ApiProperty()
  foundCaseId!: string;
  @ApiProperty()
  operationTypeId!: string;
  @ApiProperty({ required: false })
  stationId!: string | null;
  @ApiProperty({ required: false })
  fromStationId!: string | null;
  @ApiProperty({ required: false })
  toStationId!: string | null;
  @ApiProperty({ required: false })
  requestedByStationId!: string | null;
  @ApiProperty()
  performedById!: string;
  @ApiProperty({ required: false })
  pairedOperationId!: string | null;
  @ApiProperty({ enum: CustodyStatus })
  custodyStatusBefore!: CustodyStatus;
  @ApiProperty({ enum: CustodyStatus })
  custodyStatusAfter!: CustodyStatus;
  @ApiProperty({ required: false })
  notes!: string | null;
  @ApiProperty({ required: false })
  metadata!: JsonValue;
  @ApiProperty()
  createdAt!: Date;
}

export class GetDocumentOperationTypeResponseDto
  implements DocumentOperationType
{
  @ApiProperty()
  id!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  prefix!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ required: false })
  description!: string | null;
  @ApiProperty()
  requiresDestinationStation!: boolean;
  @ApiProperty()
  requiresSourceStation!: boolean;
  @ApiProperty()
  requiresNotes!: boolean;
  @ApiProperty()
  isHighPrivilege!: boolean;
  @ApiProperty()
  isFinalOperation!: boolean;
  @ApiProperty({ required: false })
  metadata!: JsonValue;
  @ApiProperty()
  voided!: boolean;
  @ApiProperty()
  createdAt!: Date;
  @ApiProperty()
  updatedAt!: Date;
}

export class GetStationOperationTypeResponseDto
  implements StationOperationType
{
  @ApiProperty()
  id!: string;
  @ApiProperty()
  stationId!: string;
  @ApiProperty()
  operationTypeId!: string;
  @ApiProperty()
  isEnabled!: boolean;
  @ApiProperty()
  voided!: boolean;
  @ApiProperty()
  createdAt!: Date;
  @ApiProperty()
  updatedAt!: Date;
}
//  My Stations─

export class MyStationOperationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class MyStationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  level1!: string;

  @ApiPropertyOptional({ nullable: true })
  level2!: string | null;

  @ApiProperty({ type: MyStationOperationDto, isArray: true })
  operations!: MyStationOperationDto[];
}

export class GetMyStationsResponseDto {
  @ApiProperty({ type: [MyStationDto] })
  results!: MyStationDto[];

  @ApiProperty()
  totalCount!: number;
}

// Staff Station Operation

export class GetStaffStationOperationResponseDto
  implements StaffStationOperation
{
  @ApiProperty()
  id!: string;
  @ApiProperty()
  userId!: string;
  @ApiProperty()
  stationId!: string;
  @ApiProperty()
  operationTypeId!: string;
  @ApiProperty()
  grantedById!: string;
  @ApiProperty()
  voided!: boolean;
  @ApiProperty({ required: false })
  voidedAt!: Date | null;
  @ApiProperty({ required: false })
  voidedById!: string | null;
  @ApiProperty()
  createdAt!: Date;
  @ApiProperty()
  updatedAt!: Date;
}

// Paginated list response DTOs

export class GetDocumentOperationsListDto extends PaginatedListBase {
  @ApiProperty({ type: [GetDocumentOperationResponseDto] })
  results!: GetDocumentOperationResponseDto[];
}

export class GetDocumentOperationTypesListDto extends PaginatedListBase {
  @ApiProperty({ type: [GetDocumentOperationTypeResponseDto] })
  results!: GetDocumentOperationTypeResponseDto[];
}

export class GetStationOperationTypesListDto extends PaginatedListBase {
  @ApiProperty({ type: [GetStationOperationTypeResponseDto] })
  results!: GetStationOperationTypeResponseDto[];
}

export class GetStaffStationOperationsListDto extends PaginatedListBase {
  @ApiProperty({ type: [GetStaffStationOperationResponseDto] })
  results!: GetStaffStationOperationResponseDto[];
}

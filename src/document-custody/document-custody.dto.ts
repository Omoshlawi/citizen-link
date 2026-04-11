import { createZodDto } from 'nestjs-zod';
import { PaginatedListBase, QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import {
  CustodyStatus,
  DocumentOperation,
  DocumentOperationItem,
  DocumentOperationItemStatus,
  DocumentOperationStatus,
} from '../../generated/prisma/client';
import { JsonValue } from '@prisma/client/runtime/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Request schemas ───────────────────────────────────────────────────────────

export const CreateDocumentOperationSchema = z.object({
  operationTypeId: z.uuid(),
  foundCaseIds: z.array(z.uuid()).min(1, 'At least one document is required'),
  stationId: z.uuid().optional(),
  fromStationId: z.uuid().optional(),
  toStationId: z.uuid().optional(),
  requestedByStationId: z.uuid().optional(),
  notes: z.string().optional(),
});

export const UpdateDocumentOperationSchema = z.object({
  stationId: z.uuid().optional().nullable(),
  fromStationId: z.uuid().optional().nullable(),
  toStationId: z.uuid().optional().nullable(),
  requestedByStationId: z.uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const AddOperationItemSchema = z.object({
  foundCaseId: z.uuid(),
  notes: z.string().optional(),
});

export const SkipOperationItemSchema = z.object({
  comment: z.string().optional(),
});

export const RejectOperationSchema = z.object({
  reasonCode: z.string().min(1),
  comment: z.string().optional(),
});

export const CancelOperationSchema = z.object({
  reasonCode: z.string().min(1),
  comment: z.string().optional(),
});

export const QueryDocumentOperationsListSchema = z.object({
  ...QueryBuilderSchema.shape,
  operationTypeId: z.uuid().optional(),
  status: z.nativeEnum(DocumentOperationStatus).optional(),
  stationId: z.uuid().optional(),
  createdById: z.uuid().optional(),
  search: z.string().optional(),
});

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateDocumentOperationDto extends createZodDto(CreateDocumentOperationSchema) {}
export class UpdateDocumentOperationDto extends createZodDto(UpdateDocumentOperationSchema) {}
export class AddOperationItemDto extends createZodDto(AddOperationItemSchema) {}
export class SkipOperationItemDto extends createZodDto(SkipOperationItemSchema) {}
export class RejectOperationDto extends createZodDto(RejectOperationSchema) {}
export class CancelOperationDto extends createZodDto(CancelOperationSchema) {}
export class QueryDocumentOperationsListDto extends createZodDto(
  QueryDocumentOperationsListSchema,
) {}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class GetDocumentOperationItemResponseDto implements DocumentOperationItem {
  @ApiProperty() id!: string;
  @ApiProperty() operationId!: string;
  @ApiProperty() foundCaseId!: string;
  @ApiProperty({ enum: DocumentOperationItemStatus }) status!: DocumentOperationItemStatus;
  @ApiProperty({ enum: CustodyStatus, required: false, nullable: true })
  custodyStatusBefore!: CustodyStatus | null;
  @ApiProperty({ enum: CustodyStatus, required: false, nullable: true })
  custodyStatusAfter!: CustodyStatus | null;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class GetDocumentOperationResponseDto implements DocumentOperation {
  @ApiProperty() id!: string;
  @ApiProperty() operationNumber!: string;
  @ApiProperty() operationTypeId!: string;
  @ApiProperty({ enum: DocumentOperationStatus }) status!: DocumentOperationStatus;
  @ApiPropertyOptional({ nullable: true }) stationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) fromStationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) toStationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) requestedByStationId!: string | null;
  @ApiProperty() createdById!: string;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;
  @ApiPropertyOptional({ nullable: true }) metadata!: JsonValue;
  @ApiPropertyOptional({ nullable: true }) completedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: [GetDocumentOperationItemResponseDto] })
  items!: GetDocumentOperationItemResponseDto[];
}

export class GetDocumentOperationsListDto extends PaginatedListBase {
  @ApiProperty({ type: [GetDocumentOperationResponseDto] })
  results!: GetDocumentOperationResponseDto[];
}

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
  stationId: z
    .uuid()
    .optional()
    .describe(
      'Station executing this operation (e.g. receiving station for RECEIPT/TRANSFER_IN, disposing station for DISPOSAL)',
    ),
  counterpartStationId: z
    .uuid()
    .optional()
    .describe(
      'The other station involved. Destination for TRANSFER_OUT, source for TRANSFER_IN and REQUISITION. Required when the operation type has requiresSourceStation or requiresDestinationStation=true.',
    ),
  responsiblePersonId: z
    .uuid()
    .optional()
    .nullable()
    .describe(
      'Staff member physically responsible for executing this operation. Defaults to the creator when not provided.',
    ),
  notes: z.string().optional(),
  targetArea: z
    .string()
    .optional()
    .describe(
      'Geographic zone for this operation batch (e.g. "Westlands", "CBD Zone A"). Required when the operation type has requiresTargetArea=true.',
    ),
});

export const UpdateDocumentOperationSchema = z.object({
  stationId: z
    .uuid()
    .optional()
    .nullable()
    .describe('Station executing this operation'),
  counterpartStationId: z
    .uuid()
    .optional()
    .nullable()
    .describe(
      'The other station involved. Destination for TRANSFER_OUT, source for TRANSFER_IN and REQUISITION.',
    ),
  responsiblePersonId: z
    .uuid()
    .optional()
    .nullable()
    .describe(
      'Staff member physically responsible for executing this operation',
    ),
  notes: z.string().optional().nullable(),
  targetArea: z.string().optional().nullable(),
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

export const GetAllowedOperationsSchema = z.object({
  stationId: z.uuid(),
  userId: z
    .string()
    .optional()
    .describe(
      'Admin use only. If not provided, the user ID will be taken from the session.',
    ),
});

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateDocumentOperationDto extends createZodDto(
  CreateDocumentOperationSchema,
) {}
export class UpdateDocumentOperationDto extends createZodDto(
  UpdateDocumentOperationSchema,
) {}
export class AddOperationItemDto extends createZodDto(AddOperationItemSchema) {}
export class SkipOperationItemDto extends createZodDto(
  SkipOperationItemSchema,
) {}
export class RejectOperationDto extends createZodDto(RejectOperationSchema) {}
export class CancelOperationDto extends createZodDto(CancelOperationSchema) {}
export class QueryDocumentOperationsListDto extends createZodDto(
  QueryDocumentOperationsListSchema,
) {}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class GetDocumentOperationItemResponseDto
  implements DocumentOperationItem
{
  @ApiProperty() id!: string;
  @ApiProperty() operationId!: string;
  @ApiProperty() foundCaseId!: string;
  @ApiProperty({ enum: DocumentOperationItemStatus })
  status!: DocumentOperationItemStatus;
  @ApiProperty({ enum: CustodyStatus, required: false, nullable: true })
  custodyStatusBefore!: CustodyStatus | null;
  @ApiProperty({ enum: CustodyStatus, required: false, nullable: true })
  custodyStatusAfter!: CustodyStatus | null;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;
  @ApiPropertyOptional({ nullable: true }) userAddressId!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class GetDocumentOperationResponseDto implements DocumentOperation {
  @ApiProperty() id!: string;
  @ApiProperty() operationNumber!: string;
  @ApiProperty() operationTypeId!: string;
  @ApiProperty({ enum: DocumentOperationStatus })
  status!: DocumentOperationStatus;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Station executing this operation',
  })
  stationId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'The other station involved. Destination for TRANSFER_OUT, source for TRANSFER_IN and REQUISITION.',
  })
  counterpartStationId!: string | null;
  @ApiProperty() createdById!: string;
  @ApiPropertyOptional({ nullable: true }) responsiblePersonId!: string | null;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;
  @ApiPropertyOptional({ nullable: true }) targetArea!: string | null;
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

export class GetDocumentOperationTypeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() prefix!: string;
  @ApiProperty() requiresDestinationStation!: boolean;
  @ApiProperty() requiresSourceStation!: boolean;
  @ApiProperty() requiresNotes!: boolean;
  @ApiProperty() isHighPrivilege!: boolean;
  @ApiProperty() isFinalOperation!: boolean;
  @ApiProperty() requiresTargetArea!: boolean;
  @ApiProperty() requiresItemAddresses!: boolean;
}

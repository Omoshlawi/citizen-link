import { createZodDto } from 'nestjs-zod';
import { PaginatedListBase, QueryBuilderSchema } from '../../common/query-builder';
import z from 'zod';
import { DocumentOperationType } from '../../../generated/prisma/client';
import { JsonValue } from '@prisma/client/runtime/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Schemas ──────────────────────────────────────────────────────────────────

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

export const UpdateDocumentOperationTypeSchema = CreateDocumentOperationTypeSchema.partial();

export const QueryDocumentOperationTypesSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z.string().optional(),
  includeVoided: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional()
    .default(false),
});

// ── DTOs ─────────────────────────────────────────────────────────────────────

export class CreateDocumentOperationTypeDto extends createZodDto(
  CreateDocumentOperationTypeSchema,
) {}
export class UpdateDocumentOperationTypeDto extends createZodDto(
  UpdateDocumentOperationTypeSchema,
) {}
export class QueryDocumentOperationTypesDto extends createZodDto(
  QueryDocumentOperationTypesSchema,
) {}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class GetDocumentOperationTypeResponseDto implements DocumentOperationType {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() prefix!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() requiresDestinationStation!: boolean;
  @ApiProperty() requiresSourceStation!: boolean;
  @ApiProperty() requiresNotes!: boolean;
  @ApiProperty() isHighPrivilege!: boolean;
  @ApiProperty() isFinalOperation!: boolean;
  @ApiPropertyOptional({ nullable: true }) metadata!: JsonValue;
  @ApiProperty() voided!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class GetDocumentOperationTypesListDto extends PaginatedListBase {
  @ApiProperty({ type: [GetDocumentOperationTypeResponseDto] })
  results!: GetDocumentOperationTypeResponseDto[];
}

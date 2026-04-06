import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import { TransitionReason } from '../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { JsonValue } from '@prisma/client/runtime/client';

export const QueryStatusTransitionReasonsSchema = z.object({
  ...QueryBuilderSchema.shape,
  reason: z.uuid().optional(),
  code: z.string().optional(),
  entityType: z.string().optional(),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  search: z.string().optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
  includeGlobal: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
  auto: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional(),
  label: z.string().optional(),
});

export class QueryStatusTransitionReasonsDto extends createZodDto(
  QueryStatusTransitionReasonsSchema,
) {}

export const StatusTransitionReasonsSchema = z.object({
  reason: z.uuid(),
  comment: z.string().optional(),
});

export class StatusTransitionReasonsDto extends createZodDto(
  StatusTransitionReasonsSchema,
) {}

export const CreateStatusTransitionReasonSchema = z.object({
  code: z.string(),
  entityType: z.string().default('*'),
  fromStatus: z.string().default('*'),
  toStatus: z.string().default('*'),
  auto: z.boolean().default(false),
  label: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export class CreateStatusTransitionReasonDto extends createZodDto(
  CreateStatusTransitionReasonSchema,
) {}

export const UpdateStatusTransitionReasonSchema =
  CreateStatusTransitionReasonSchema.partial();

export class UpdateStatusTransitionReasonDto extends createZodDto(
  UpdateStatusTransitionReasonSchema,
) {}

export class GetTransitionReasonResponseDto implements TransitionReason {
  @ApiProperty()
  metadata: JsonValue;
  @ApiProperty()
  code: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  fromStatus: string;

  @ApiProperty()
  toStatus: string;

  @ApiProperty()
  auto: boolean;

  @ApiProperty()
  label: string;

  @ApiProperty()
  id: string;

  @ApiProperty()
  description: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  voided: boolean;
}

export class QueryTransitionReasonsResponseDto {
  @ApiProperty({ isArray: true, type: GetTransitionReasonResponseDto })
  results: GetTransitionReasonResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  currentPage: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  next: string | null;

  @ApiProperty()
  prev: string | null;
}

export class EntityTypeResponseDto {
  @ApiProperty({ isArray: true, type: String })
  results: string[];

  @ApiProperty()
  totalCount: number;
}

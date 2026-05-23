import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';

// ── Query DTOs ────────────────────────────────────────────────────────────────

export const ListDocaiJobsSchema = z.object({
  job_type: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(100).optional(),
});
export class ListDocaiJobsDto extends createZodDto(ListDocaiJobsSchema) {}

export const ListDocaiStagesSchema = z.object({
  job_id: z.uuid().optional(),
  job_type: z.string().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
  include_result: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(100).optional(),
});
export class ListDocaiStagesDto extends createZodDto(ListDocaiStagesSchema) {}

export const GetDocaiStageSchema = z.object({
  include_result: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  include_conversations: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
});
export class GetDocaiStageDto extends createZodDto(GetDocaiStageSchema) {}

export const GetDocaiJobStagesSchema = z.object({
  include_result: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  include_conversations: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
});
export class GetDocaiJobStagesDto extends createZodDto(
  GetDocaiJobStagesSchema,
) {}

export const ListDocaiConversationsSchema = z.object({
  job_id: z.uuid().optional(),
  stage_id: z.uuid().optional(),
  stage: z.string().optional(),
  success: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  page_num: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(100).optional(),
});
export class ListDocaiConversationsDto extends createZodDto(
  ListDocaiConversationsSchema,
) {}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class DocaiJobStatusDto {
  @ApiProperty() job_id: string;
  @ApiProperty() job_type: string;
  @ApiProperty() priority: number;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true }) current_stage: string | null;
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
}

export class DocaiJobListDto {
  @ApiProperty({ type: [DocaiJobStatusDto] }) jobs: DocaiJobStatusDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() page_size: number;
}

export class DocaiStageResponseDto {
  @ApiProperty() stage_id: string;
  @ApiProperty() job_id: string;
  @ApiProperty({ description: 'Stage name: VISION, STRUCTURE, …' })
  stage: string;
  @ApiProperty({ description: 'SUCCESS or FAILED' }) status: string;
  @ApiPropertyOptional({ nullable: true }) error: string | null;
  @ApiPropertyOptional({ nullable: true, type: Object })
  usage: Record<string, unknown> | null;
  @ApiPropertyOptional({ nullable: true }) started_at: string | null;
  @ApiProperty() completed_at: string;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional({
    nullable: true,
    type: Object,
    description:
      'Raw stage output JSONB — only populated when include_result=true',
  })
  result: Record<string, unknown> | null;
  @ApiProperty() job_type: string;
  @ApiProperty() job_status: string;
  @ApiProperty() job_priority: number;
}

export class DocaiStageListDto {
  @ApiProperty({ type: [DocaiStageResponseDto] })
  stages: DocaiStageResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() page_size: number;
}

export class DocaiConversationResponseDto {
  @ApiProperty() conversation_id: string;
  @ApiProperty() stage_id: string;
  @ApiProperty() job_id: string;
  @ApiProperty({
    description: 'Correction round (1 = first attempt; 2+ = corrections)',
  })
  round: number;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Image page number (Vision only)',
  })
  page: number | null;
  @ApiProperty({ description: 'system | user | assistant' }) role: string;
  @ApiProperty() content: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Set only on assistant rows',
  })
  success: boolean | null;
  @ApiPropertyOptional({ nullable: true, type: Object }) metadata: Record<
    string,
    unknown
  > | null;
  @ApiProperty() created_at: string;
  @ApiProperty() stage_name: string;
  @ApiProperty() stage_status: string;
  @ApiProperty() job_type: string;
}

export class DocaiStageDetailDto extends DocaiStageResponseDto {
  @ApiProperty({
    type: [DocaiConversationResponseDto],
    description: 'Populated when include_conversations=true',
  })
  conversations: DocaiConversationResponseDto[];
}

export class DocaiJobStagesDto {
  @ApiProperty() job_id: string;
  @ApiProperty() job_type: string;
  @ApiProperty() job_status: string;
  @ApiProperty({ type: [DocaiStageDetailDto] }) stages: DocaiStageDetailDto[];
}

export class DocaiConversationListDto {
  @ApiProperty({ type: [DocaiConversationResponseDto] })
  conversations: DocaiConversationResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() page_size: number;
}

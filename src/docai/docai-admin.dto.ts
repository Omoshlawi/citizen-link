import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';

// ── Query DTOs (camelCase — mapped to DocAI snake_case in service) ─────────────

export const ListDocaiJobsSchema = z.object({
  jobType: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export class ListDocaiJobsDto extends createZodDto(ListDocaiJobsSchema) {}

export const ListDocaiStagesSchema = z.object({
  jobId: z.uuid().optional(),
  jobType: z.string().optional(),
  stageName: z.string().optional(),
  status: z.string().optional(),
  includeResult: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export class ListDocaiStagesDto extends createZodDto(ListDocaiStagesSchema) {}

export const GetDocaiStageSchema = z.object({
  includeResult: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  includeConversations: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
});
export class GetDocaiStageDto extends createZodDto(GetDocaiStageSchema) {}

export const GetDocaiJobStagesSchema = z.object({
  includeResult: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  includeConversations: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
});
export class GetDocaiJobStagesDto extends createZodDto(
  GetDocaiJobStagesSchema,
) {}

export const ListDocaiConversationsSchema = z.object({
  jobId: z.uuid().optional(),
  stageId: z.uuid().optional(),
  stageName: z.string().optional(),
  success: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  pageNum: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export class ListDocaiConversationsDto extends createZodDto(
  ListDocaiConversationsSchema,
) {}

export const ListDocaiWebhooksSchema = z.object({
  jobId: z.uuid().optional(),
  event: z.string().optional(),
  delivered: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export class ListDocaiWebhooksDto extends createZodDto(
  ListDocaiWebhooksSchema,
) {}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class DocaiJobStatusDto {
  @ApiProperty() job_id: string;
  @ApiProperty() job_type: string;
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
      'Raw stage output JSONB — only populated when includeResult=true',
  })
  result: Record<string, unknown> | null;
  @ApiProperty() job_type: string;
  @ApiProperty() job_status: string;
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
    description: 'Populated when includeConversations=true',
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

export class DocaiWebhookDeliveryDto {
  @ApiProperty() delivery_id: string;
  @ApiProperty() job_id: string;
  @ApiProperty({ description: 'e.g. extraction.vision.success' }) event: string;
  @ApiProperty() callback_url: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'HTTP status returned by the caller',
  })
  response_status: number | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'First 2 000 chars of the response body',
  })
  response_body: string | null;
  @ApiProperty() attempt_count: number;
  @ApiProperty() delivered: boolean;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional({
    nullable: true,
    type: Object,
    description: 'Full payload — only populated on single-record fetch',
  })
  payload: Record<string, unknown> | null;
  @ApiProperty() job_type: string;
  @ApiProperty() job_status: string;
}

export class DocaiWebhookDeliveryListDto {
  @ApiProperty({ type: [DocaiWebhookDeliveryDto] })
  deliveries: DocaiWebhookDeliveryDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() page_size: number;
}

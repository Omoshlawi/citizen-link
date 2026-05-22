import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DocaiStage = z.enum(['VISION', 'COMPLETED', 'FAILED']);
export const DocaiStatus = z.enum(['in_progress', 'completed', 'failed']);

const CompletedResultSchema = z.object({
  fields: z.record(z.string(), z.unknown()),
  ocrConfidence: z.number().nullable(),
  extractionConfidence: z.number().nullable(),
});

const FailedResultSchema = z.object({
  failedAt: z.enum(['VISION', 'STRUCTURE']),
  reason: z.string(),
});

export const DocaiWebhookSchema = z.object({
  jobId: z.string().uuid(),
  stage: DocaiStage,
  status: DocaiStatus,
  result: z.union([CompletedResultSchema, FailedResultSchema]).nullable(),
  timestamp: z.string(),
});

export class DocaiWebhookDto extends createZodDto(DocaiWebhookSchema) {}

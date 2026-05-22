import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * All webhook events emitted by docai — single source of truth.
 *
 * Format: {pipeline-namespace}.{stage}.{success|failed}
 * Terminal success: {namespace}.success  — nested combined payload
 * Terminal failure: {namespace}.failed   — flat rollup (fires alongside stage event)
 *
 * Every event carries the actual output of that stage.
 * {namespace}.success nests all stage outputs so consumers pick what they need.
 *
 * Mirror: app/pipeline/enums.py :: DocaiEvent — keep both in sync.
 */
export enum DocaiEvent {
  // ── EXTRACTION pipeline ─────────────────────────────────────────────────────
  EXTRACTION_VISION_SUCCESS = 'extraction.vision.success', // raw VisionAgent output
  EXTRACTION_STRUCTURE_SUCCESS = 'extraction.structure.success', // raw StructureAgent output
  EXTRACTION_SUCCESS = 'extraction.success', // nested { vision, structure } — terminal
  EXTRACTION_VISION_FAILED = 'extraction.vision.failed', // terminal, stage-specific
  EXTRACTION_STRUCTURE_FAILED = 'extraction.structure.failed', // terminal, stage-specific
  EXTRACTION_FAILED = 'extraction.failed', // terminal, flat rollup
  // ── Future pipelines ────────────────────────────────────────────────────────
  // FRAUD_DETECTION_CHECK_SUCCESS = 'fraud-detection.check.success',
  // FRAUD_DETECTION_SUCCESS       = 'fraud-detection.success',
  // FRAUD_DETECTION_CHECK_FAILED  = 'fraud-detection.check.failed',
  // FRAUD_DETECTION_FAILED        = 'fraud-detection.failed',
}

export const DocaiWebhookSchema = z.object({
  jobId: z.string().uuid(),
  event: z.nativeEnum(DocaiEvent),
  /** Shape varies by event — handlers cast to the appropriate typed interface. */
  result: z.record(z.string(), z.unknown()).nullable(),
  timestamp: z.string(),
});

export class DocaiWebhookDto extends createZodDto(DocaiWebhookSchema) {}

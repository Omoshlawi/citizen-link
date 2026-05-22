/** Payload NestJS sends to POST /v1/jobs/extraction */
export interface DocaiExtractionRequest {
  case_number: string;
  image_urls: string[];
  webhook_url: string;
  /** 1 (highest) – 10 (lowest). Default 5. */
  priority?: number;
}

// Future pipeline request types go here as new endpoints are added:
// export interface DocaiFraudCheckRequest { ... }
// export interface DocaiMatchVerificationRequest { ... }

/** Response from POST /v1/jobs/extraction (202) */
export interface DocaiProcessResponse {
  job_id: string;
}

/** docai POSTs this to webhook_url on every stage transition */
export interface DocaiWebhookPayload {
  jobId: string;
  /** Dot-notation event — encodes pipeline, stage, and outcome in one field. */
  event: import('./docai-webhook.schema').DocaiEvent;
  result: Record<string, unknown> | null;
  timestamp: string;
}

// ── Per-stage success result types ────────────────────────────────────────────

/**
 * Carried by extraction.vision.success — raw VisionAgent output.
 * Consumers interested in OCR quality or raw text read this event.
 */
export interface DocaiVisionSuccessResult {
  fullText?: string | null;
  averageConfidence?: number | null;
}

/**
 * Carried by extraction.structure.success — raw StructureAgent output.
 * Same shape as DocaiExtractedFields — every field is optional.
 * Consumers interested in the extracted fields before the final rollup read this event.
 */
export type DocaiStructureSuccessResult = DocaiExtractedFields;

// ── Terminal success result type ───────────────────────────────────────────────

/**
 * Carried by extraction.success — nested combined result.
 * Consumers pick what they need: vision data, structure data, or both.
 */
export interface DocaiExtractionSuccessResult {
  vision: DocaiVisionSuccessResult;
  structure: DocaiExtractedFields;
}

// ── Failure result types ───────────────────────────────────────────────────────

/**
 * Carried by stage-specific failure events
 * (extraction.vision.failed, extraction.structure.failed).
 * The event field already encodes which stage failed — only the reason is needed here.
 */
export interface DocaiStageFailed {
  reason: string;
}

/**
 * Carried by extraction.failed — flat rollup that fires alongside the stage event.
 * Consumers who want a single failure listener use this event.
 */
export interface DocaiRollupFailed {
  /** Lower-cased stage name where the failure occurred (e.g. "vision", "structure"). */
  failedAt: string;
  reason: string;
}

/** Request body for POST /v1/embed */
export interface DocaiEmbedRequest {
  text: string;
  /** 'document' (default) prefixes with search_document:; 'search' uses search_query: */
  use_case?: 'document' | 'search';
}

/** Response from POST /v1/embed */
export interface DocaiEmbedResponse {
  embedding: number[];
  /** Vector dimensions — 768 for nomic-embed-text, 1536 for OpenAI text-embedding-* */
  dims: number;
  model: string;
}

/** Structured fields as returned by docai's StructureAgent */
export interface DocaiExtractedFields {
  documentType?: { code?: string; confidence?: number } | null;
  country?: string | null;
  person?: {
    fullName?: string | null;
    givenNames?: string[];
    surname?: string | null;
    dateOfBirth?: string | null;
    placeOfBirth?: string | null;
    gender?: string | null;
  } | null;
  document?: {
    number?: string | null;
    serialNumber?: string | null;
    batchNumber?: string | null;
    issuer?: string | null;
    placeOfIssue?: string | null;
    issueDate?: string | null;
    expiryDate?: string | null;
  } | null;
  address?: {
    raw?: string | null;
    country?: string | null;
    components?: Array<{ type: string; value: string }>;
  } | null;
  biometrics?: {
    fingerprintPresent?: boolean;
    photoPresent?: boolean;
    signaturePresent?: boolean;
  } | null;
  additionalFields?: Array<{ fieldName: string; fieldValue: string }>;
  quality?: {
    ocrConfidence?: number | null;
    extractionConfidence?: number | null;
    warnings?: string[];
  } | null;
  averageConfidence?: number | null;
}

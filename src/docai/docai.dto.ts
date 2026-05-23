import { ApiProperty } from '@nestjs/swagger';
import { DocaiEvent } from './docai-webhook.schema';

// ── Nested sub-types for DocaiExtractedFields ─────────────────────────────────

export class DocaiDocumentTypeInfo {
  @ApiProperty({
    required: false,
    example: 'national_id',
    description: 'Normalised document-type code produced by the StructureAgent',
  })
  code?: string;

  @ApiProperty({
    required: false,
    example: 0.97,
    description: 'Model confidence for the detected document type (0–1)',
  })
  confidence?: number;
}

export class DocaiPersonInfo {
  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Jane Achieng Otieno',
    description: 'Full name as it appears on the document',
  })
  fullName?: string | null;

  @ApiProperty({
    required: false,
    isArray: true,
    type: String,
    example: ['Jane', 'Achieng'],
    description: 'Given names in document order',
  })
  givenNames?: string[];

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Otieno',
    description: 'Surname / family name',
  })
  surname?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: '1990-04-15',
    description: 'Date of birth in ISO 8601 (YYYY-MM-DD)',
  })
  dateOfBirth?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Kisumu',
    description: 'Place of birth as printed on the document',
  })
  placeOfBirth?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'F',
    description: 'Gender as printed on the document (M / F or full word)',
  })
  gender?: string | null;
}

export class DocaiDocumentInfo {
  @ApiProperty({
    required: false,
    nullable: true,
    example: '12345678',
    description: 'Primary document number (ID / passport number)',
  })
  number?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'SN-987654',
    description: 'Serial number if present on the document',
  })
  serialNumber?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'BN-001',
    description: 'Batch or book number if present',
  })
  batchNumber?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Government of Kenya',
    description: 'Issuing authority',
  })
  issuer?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Nairobi',
    description: 'Place where the document was issued',
  })
  placeOfIssue?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: '2018-06-01',
    description: 'Date of issue in ISO 8601 (YYYY-MM-DD)',
  })
  issueDate?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: '2028-06-01',
    description: 'Expiry date in ISO 8601 (YYYY-MM-DD)',
  })
  expiryDate?: string | null;
}

export class DocaiAddressComponent {
  @ApiProperty({
    example: 'county',
    description: 'Administrative level or address-component type',
  })
  type: string;

  @ApiProperty({
    example: 'Nairobi',
    description: 'Value of this address component',
  })
  value: string;
}

export class DocaiAddressInfo {
  @ApiProperty({
    required: false,
    nullable: true,
    example: 'P.O. Box 12345, Nairobi, Kenya',
    description: 'Raw address string as printed on the document',
  })
  raw?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'KE',
    description: 'ISO 3166-1 alpha-2 country derived from the address',
  })
  country?: string | null;

  @ApiProperty({
    required: false,
    isArray: true,
    type: () => DocaiAddressComponent,
    description: 'Parsed address components in hierarchical order',
  })
  components?: DocaiAddressComponent[];
}

export class DocaiBiometricsInfo {
  @ApiProperty({
    required: false,
    example: false,
    description:
      'True when a fingerprint impression is visible on the document',
  })
  fingerprintPresent?: boolean;

  @ApiProperty({
    required: false,
    example: true,
    description: 'True when a portrait photo is present on the document',
  })
  photoPresent?: boolean;

  @ApiProperty({
    required: false,
    example: true,
    description: 'True when a signature field is present on the document',
  })
  signaturePresent?: boolean;
}

export class DocaiAdditionalField {
  @ApiProperty({
    example: 'nationality',
    description: 'Name of the additional extracted field',
  })
  fieldName: string;

  @ApiProperty({
    example: 'Kenyan',
    description: 'Value of the additional extracted field',
  })
  fieldValue: string;
}

export class DocaiQualityInfo {
  @ApiProperty({
    required: false,
    nullable: true,
    example: 0.91,
    description: 'Mean OCR confidence across all text on the document (0–1)',
  })
  ocrConfidence?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 0.87,
    description: 'Overall field-extraction confidence (0–1)',
  })
  extractionConfidence?: number | null;

  @ApiProperty({
    required: false,
    isArray: true,
    type: String,
    example: ['low_contrast_detected', 'partial_occlusion'],
    description: 'Non-fatal quality warnings from the extraction pipeline',
  })
  warnings?: string[];
}

// ── Structured fields — StructureAgent output ─────────────────────────────────

/** Structured fields as returned by docai's StructureAgent */
export class DocaiExtractedFields {
  @ApiProperty({
    required: false,
    nullable: true,
    type: () => DocaiDocumentTypeInfo,
    description: 'Detected document type with normalised code and confidence',
  })
  documentType?: DocaiDocumentTypeInfo | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'KE',
    description: 'ISO 3166-1 alpha-2 country code detected on the document',
  })
  country?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => DocaiPersonInfo,
    description: 'Personal identity details extracted from the document',
  })
  person?: DocaiPersonInfo | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => DocaiDocumentInfo,
    description: 'Document-level fields (number, issuer, dates, etc.)',
  })
  document?: DocaiDocumentInfo | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => DocaiAddressInfo,
    description: 'Address information extracted from the document',
  })
  address?: DocaiAddressInfo | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => DocaiBiometricsInfo,
    description: 'Biometric feature presence flags',
  })
  biometrics?: DocaiBiometricsInfo | null;

  @ApiProperty({
    required: false,
    isArray: true,
    type: () => DocaiAdditionalField,
    description:
      'Any extra fields the StructureAgent found outside the known schema',
  })
  additionalFields?: DocaiAdditionalField[];

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => DocaiQualityInfo,
    description: 'Extraction quality metrics and warnings',
  })
  quality?: DocaiQualityInfo | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 0.89,
    description: 'Mean confidence across all extracted fields (0–1)',
  })
  averageConfidence?: number | null;
}

// ── Per-stage success result types ────────────────────────────────────────────

/**
 * Carried by extraction.vision.success — raw VisionAgent output.
 * Consumers interested in OCR quality or raw text read this event.
 */
export class DocaiVisionSuccessResult {
  @ApiProperty({
    required: false,
    nullable: true,
    example: 'REPUBLIC OF KENYA\nNATIONAL IDENTITY CARD\n...',
    description: 'Full OCR text concatenated from all document image regions',
  })
  fullText?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 0.93,
    description: 'Mean OCR confidence across the entire document (0–1)',
  })
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
export class DocaiExtractionSuccessResult {
  @ApiProperty({
    type: () => DocaiVisionSuccessResult,
    description: 'OCR output from the VisionAgent stage',
  })
  vision: DocaiVisionSuccessResult;

  @ApiProperty({
    type: () => DocaiExtractedFields,
    description: 'Structured fields from the StructureAgent stage',
  })
  structure: DocaiExtractedFields;
}

// ── Failure result types ───────────────────────────────────────────────────────

/**
 * Carried by stage-specific failure events
 * (extraction.vision.failed, extraction.structure.failed).
 */
export class DocaiStageFailed {
  @ApiProperty({
    example: 'Image too blurry for OCR processing',
    description: 'Human-readable reason describing why the stage failed',
  })
  reason: string;
}

/**
 * Carried by extraction.failed — flat rollup that fires alongside the stage event.
 * Consumers who want a single failure listener use this event.
 */
export class DocaiRollupFailed {
  @ApiProperty({
    example: 'vision',
    description: 'Lower-cased stage name where the failure occurred',
  })
  failedAt: string;

  @ApiProperty({
    example: 'Image too blurry for OCR processing',
    description: 'Human-readable reason describing why the pipeline failed',
  })
  reason: string;
}

// ── Webhook payload ───────────────────────────────────────────────────────────

/** docai POSTs this to webhook_url on every stage transition */
export class DocaiWebhookPayload {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'Docai job UUID — matches the id returned by POST /v1/jobs/extraction',
  })
  jobId: string;

  @ApiProperty({
    enum: DocaiEvent,
    example: DocaiEvent.EXTRACTION_SUCCESS,
    description:
      'Dot-notation pipeline event encoding pipeline, stage, and outcome',
  })
  event: DocaiEvent;

  @ApiProperty({
    nullable: true,
    example: {
      vision: { averageConfidence: 0.93 },
      structure: { country: 'KE' },
    },
    description:
      'Stage-specific payload; shape varies by event. Null for intermediate or error events with no output.',
  })
  result: Record<string, unknown> | null;

  @ApiProperty({
    example: '2024-06-01T10:30:00.000Z',
    description: 'ISO-8601 timestamp of when docai emitted this event',
  })
  timestamp: string;
}

// ── Outbound request / response types ────────────────────────────────────────

/** Payload NestJS sends to POST /v1/jobs/extraction */
export class DocaiExtractionRequest {
  @ApiProperty({
    example: 'CASE-2024-001234',
    description:
      'Case number used by docai as a correlation key for webhook callbacks',
  })
  case_number: string;

  @ApiProperty({
    isArray: true,
    type: String,
    example: ['tmp/front.jpg', 'tmp/back.jpg'],
    description: 'S3 object keys for the document images in page order',
  })
  image_keys: string[];

  @ApiProperty({
    example: 'https://api.citizenlink.example/api/webhooks/docai/progress',
    description: 'URL that docai will POST event-based webhook payloads to',
  })
  webhook_url: string;

}

/** Response from POST /v1/jobs/extraction (202) */
export class DocaiProcessResponse {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID assigned to this extraction job by docai',
  })
  job_id: string;
}

// ── Embed request / response types ───────────────────────────────────────────

/** Request body for POST /v1/embed */
export class DocaiEmbedRequest {
  @ApiProperty({
    example: 'National Identity Card Kenya male Nairobi 1990',
    description: 'Text to embed',
  })
  text: string;

  @ApiProperty({
    required: false,
    enum: ['document', 'search'],
    example: 'document',
    description:
      '"document" prefixes with search_document: (default); "search" uses search_query:',
  })
  use_case?: 'document' | 'search';
}

/** Response from POST /v1/embed */
export class DocaiEmbedResponse {
  @ApiProperty({
    isArray: true,
    type: Number,
    example: [0.012, -0.345, 0.678],
    description: 'Dense embedding vector',
  })
  embedding: number[];

  @ApiProperty({
    example: 768,
    description:
      'Number of dimensions — 768 for nomic-embed-text, 1536 for OpenAI text-embedding-*',
  })
  dims: number;

  @ApiProperty({
    example: 'nomic-embed-text-v1.5',
    description: 'Model identifier used to produce the embedding',
  })
  model: string;
}

// ── Internal service params ───────────────────────────────────────────────────

export class SubmitExtractionParams {
  @ApiProperty({
    example: 'CASE-2024-001234',
    description: 'Case number forwarded to docai as a correlation key',
  })
  caseNumber: string;

  @ApiProperty({
    isArray: true,
    type: String,
    example: ['tmp/front.jpg'],
    description: 'S3 object keys for the document images in page order',
  })
  imageKeys: string[];

  @ApiProperty({
    example: 'https://api.citizenlink.example/api/webhooks/docai/progress',
    description: 'URL docai will POST event-based webhooks to',
  })
  webhookUrl: string;

}

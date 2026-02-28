import { createZodDto } from 'nestjs-zod';
import { DocumentTypeCode } from '../document-types/document-type.dto';
import { z } from 'zod';

// --- Reusable primitives ---

const AddressComponentSchema = z.object({
  type: z.string().min(1), // e.g. "county", "state", "province", "zip", "postcode", "city", "street", "ward"
  value: z.string().min(1),
});

const AdditionalFieldSchema = z.object({
  fieldName: z.string().min(1),
  fieldValue: z.string(),
});

// --- Document type codes ---

export const DocumentTypeCodeSchema = z.enum(DocumentTypeCode);

// --- Warning codes ---

export const ExtractionWarningSchema = z.enum([
  'LOW_OCR_CONFIDENCE',
  'DOCUMENT_TYPE_UNCERTAIN',
  'MULTIPLE_DOB_VALUES_FOUND',
  'MULTIPLE_ID_VALUES_FOUND',
  'MISSING_CRITICAL_FIELD',
  'LOW_EXTRACTION_CONFIDENCE',
  'CONFLICTING_NAME_VALUES',
  'EXPIRED_DOCUMENT',
]);

// --- Main schema ---

export const TextExtractionOutputSchema = z.object({
  documentType: z.object({
    code: DocumentTypeCodeSchema,
    confidence: z.coerce.number().min(0).max(100),
  }),

  country: z
    .string()
    .length(2)
    .nullable()
    .describe('ISO 3166-1 alpha-2 e.g. "KE", "US", "GB"'),

  person: z.object({
    fullName: z
      .string()
      .nullable()
      .optional()
      .describe('Full name as it appears on document'),
    givenNames: z
      .array(z.string())
      .default([])
      .describe('Split given names for matching'),
    surname: z.string().nullable().optional().describe('Surname for matching'),
    dateOfBirth: z.iso.date().nullable().optional().describe('Date of birth'),
    placeOfBirth: z.string().nullable().optional().describe('Place of birth'),
    gender: z.enum(['Male', 'Female', 'Unknown']).describe('Gender'),
  }),

  document: z.object({
    number: z.string().nullable().optional().describe('Document number'),
    serialNumber: z
      .string()
      .nullable()
      .optional()
      .describe('Document serial number'),
    batchNumber: z
      .string()
      .nullable()
      .optional()
      .describe('Document batch number'),
    issuer: z
      .string()
      .nullable()
      .optional()
      .describe('Institution or authority that issued the document'),
    placeOfIssue: z
      .string()
      .nullable()
      .optional()
      .describe('Document place of issue'),
    issueDate: z.iso
      .date()
      .nullable()
      .optional()
      .describe('Document issue date'),
    expiryDate: z.iso
      .date()
      .nullable()
      .optional()
      .describe('Document expiry date'),
  }),

  address: z.object({
    raw: z
      .string()
      .nullable()
      .optional()
      .describe('Raw address as seen in the document'),
    country: z.string().length(2).nullable().optional().describe('Country'),
    components: AddressComponentSchema.array().default([]),
  }),

  biometrics: z.object({
    photoPresent: z.boolean().default(false),
    fingerprintPresent: z.boolean().default(false),
    signaturePresent: z.boolean().default(false),
  }),

  additionalFields: AdditionalFieldSchema.array()
    .default([])
    .describe('Any field on the document not covered above'),

  raw: z.object({
    blocksUsed: z
      .array(z.string())
      .default([])
      .describe('Block IDs used — for auditability'),
  }),

  quality: z.object({
    ocrConfidence: z
      .number()
      .min(0)
      .max(100)
      .describe('Passed from vision output — 0–100'),
    extractionConfidence: z
      .number()
      .min(0)
      .max(100)
      .describe('Overall confidence in the extracted data — 0–100'),
    warnings: ExtractionWarningSchema.array().default([]), // typed — no random strings
  }),
});

// --- Inferred types from schema (single source of truth) ---

export type ExtractionWarning = z.infer<typeof ExtractionWarningSchema>;
export type AddressComponent = z.infer<typeof AddressComponentSchema>;
export type AdditionalField = z.infer<typeof AdditionalFieldSchema>;
export class TextExtractionOutputDto extends createZodDto(
  TextExtractionOutputSchema,
) {}

export const SecurityQuestionsSchema = z.object({
  questions: z
    .object({
      question: z.string(),
      answer: z.string(),
    })
    .array()
    .nonempty('At least one question is required'),
});

export class SecurityQuestionsDto extends createZodDto(
  SecurityQuestionsSchema,
) {}

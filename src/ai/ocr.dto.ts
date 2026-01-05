import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const ImageProcessOptionsSchema = z.object({
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  fit: z
    .enum(['cover', 'contain', 'fill', 'inside', 'outside'])
    .optional()
    .default('cover'),
  grayScale: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional()
    .default(false),
  contrast: z.coerce.number().optional(),
  brightness: z.coerce.number().optional(),
  hue: z.coerce.number().optional(),
  saturation: z.coerce.number().optional(),
  lightness: z.coerce.number().optional(),
  sharpness: z.coerce.number().optional(),
  blur: z.coerce.number().optional(),
  normalize: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional(),
  threshold: z.coerce.number().optional(),
});

export const DataExtractionSchema = z.object({
  serialNumber: z.string().optional(),
  documentNumber: z.string().optional(),
  batchNumber: z.string().optional(),
  issuer: z.string().optional(),
  ownerName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  placeOfBirth: z.string().optional(),
  placeOfIssue: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Unknown']).optional(),
  note: z.string().optional(),
  typeId: z.string(),
  issuanceDate: z.string().optional(),
  expiryDate: z.string().optional(),
  additionalFields: z
    .object({
      fieldName: z.string(),
      fieldValue: z.string(),
    })
    .array()
    .optional(),
});

export const SecurityQuestionsSchema = z.object({
  questions: z
    .object({
      question: z.string(),
      answer: z.string(),
    })
    .array()
    .nonempty('At least one question is required'),
});

export const ConfidenceSchema = z.object({
  documentNumber: z.number().min(0).max(100).optional(),
  ownerName: z.number().min(0).max(100).optional(),
  dateOfBirth: z.number().min(0).max(100).optional(),
  issuer: z.number().min(0).max(100).optional(),
  typeId: z.number().min(0).max(100).optional(),
  expiryDate: z.number().min(0).max(100).optional(),
  additionalFields: z
    .array(
      z.object({
        fieldName: z.string(),
        fieldValue: z.string(),
        nameScore: z.number().min(0).max(100),
        valueScore: z.number().min(0).max(100),
      }),
    )
    .optional(),
  securityQuestions: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
        questionScore: z.number().min(0).max(100),
        answerScore: z.number().min(0).max(100),
      }),
    )
    .optional(),
});

export const ImageAnalysisSchema = z
  .object({
    index: z.number(),
    imageType: z.string().optional(),
    quality: z.number().min(0).max(100),
    readability: z.number().min(0).max(100),
    focus: z.number().min(0).max(100).optional(),
    lighting: z.number().min(0).max(100).optional(),
    tamperingDetected: z.boolean(),
    warnings: z.array(z.string()),
    usableForExtraction: z.boolean().optional(),
  })
  .array();

export class DataExtractionDto extends createZodDto(DataExtractionSchema) {}

export class ImageAnalysisDto extends createZodDto(ImageAnalysisSchema) {}

export class ConfidenceDto extends createZodDto(ConfidenceSchema) {}

export class SecurityQuestionsDto extends createZodDto(
  SecurityQuestionsSchema,
) {}

export const OCRImageProcessingOptions = ImageProcessOptionsSchema.extend({
  path: z
    .string()
    .min(1, 'Required')
    .startsWith('uploads', 'Invalid file path'),
  mode: z.enum(['preview', 'scanned']).optional(),
});

export class OCRImageProcessingOptionsDto extends createZodDto(
  OCRImageProcessingOptions,
) {}

export class ImageProcessingOptionsDto extends createZodDto(
  ImageProcessOptionsSchema,
) {}

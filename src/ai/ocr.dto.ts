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

export const DocAiExtractSchema = z.object({
  serialNumber: z.string().optional(),
  documentNumber: z.string().optional(),
  batchNumber: z.string().optional(),
  issuer: z.string().optional(),
  ownerName: z.string(),
  dateOfBirth: z.string().optional(),
  placeOfBirth: z.string().optional(),
  placeOfIssue: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Unknown']).optional(),
  nationality: z.string().optional(),
  note: z.string().optional(),
  typeId: z.string(),
  issuanceDate: z.string().optional(),
  expiryDate: z.iso.date().optional(),
  additionalFields: z
    .object({
      fieldName: z.string(),
      fieldValue: z.string(),
    })
    .array()
    .optional(),
  securityQuestions: z
    .object({
      question: z.string(),
      answer: z.string(),
    })
    .array()
    .optional(),
});

export class DocAiExtractDto extends createZodDto(DocAiExtractSchema) {}

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

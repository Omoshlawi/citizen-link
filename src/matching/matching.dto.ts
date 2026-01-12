import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../query-builder';
import z from 'zod';

export const MatchStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'COMPLETED',
  'DISPUTED',
]);

export const QueryMatchesSchema = z.object({
  ...QueryBuilderSchema.shape,
  lostDocumentCaseId: z.uuid().optional(),
  foundDocumentCaseId: z.uuid().optional(),
  status: MatchStatusSchema.optional(),
  minMatchScore: z.number().min(0).max(1).optional(),
  maxMatchScore: z.number().min(0).max(1).optional(),
  adminVerified: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional(),
});

export const MatchResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'NO_MATCH']),
  recommendation: z.enum([
    'SAME_PERSON',
    'LIKELY_SAME',
    'POSSIBLY_SAME',
    'DIFFERENT_PERSON',
  ]),
  reasoning: z.string(),
  fieldAnalysis: z
    .object({
      fieldName: z.string(),
      match: z.boolean(),
      confidence: z.number().min(0).max(100),
      note: z.string().optional(),
    })
    .array(),
  matchingFields: z.array(z.string()),
  conflictingFields: z.array(z.string()),
  redFlags: z.array(z.string()),
  confidenceFactors: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  }),
});

const CreateMatchSchema = z.object({
  lostDocumentCaseId: z.uuid(),
  foundDocumentCaseId: z.uuid(),
  matchScore: z.number().min(0).max(1).optional(),
  aiMatchReasons: z.record(z.string(), z.any()).optional(),
});

const UpdateMatchStatusSchema = z.object({
  status: MatchStatusSchema,
  notes: z.string().optional(),
});

const AcceptMatchSchema = z.object({
  notes: z.string().optional(),
});

const RejectMatchSchema = z.object({
  reason: z.string().optional(),
});

const CompleteMatchSchema = z.object({
  handoverDate: z.string().datetime().optional(),
  handoverLocation: z.string().optional(),
  handoverCode: z.string().optional(),
  notes: z.string().optional(),
});

const AdminVerifyMatchSchema = z.object({
  verified: z.boolean(),
  notes: z.string().optional(),
});

export class MatchResultDto extends createZodDto(MatchResultSchema) {}

export class QueryMatchesDto extends createZodDto(QueryMatchesSchema) {}

export class CreateMatchDto extends createZodDto(CreateMatchSchema) {}

export class UpdateMatchStatusDto extends createZodDto(
  UpdateMatchStatusSchema,
) {}

export class AcceptMatchDto extends createZodDto(AcceptMatchSchema) {}

export class RejectMatchDto extends createZodDto(RejectMatchSchema) {}

export class CompleteMatchDto extends createZodDto(CompleteMatchSchema) {}

export class AdminVerifyMatchDto extends createZodDto(AdminVerifyMatchSchema) {}

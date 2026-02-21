import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import { Match, MatchStatus } from 'generated/prisma/client';
import { JsonValue } from '@prisma/client/runtime/client';
import { ApiProperty } from '@nestjs/swagger';

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
  minMatchScore: z.coerce.number().min(0).max(100).optional(),
  maxMatchScore: z.coerce.number().min(0).max(100).optional(),
  documentCaseId: z.uuid().optional(),
  search: z.string().optional(),
  userId: z
    .string()
    .optional()
    .describe('Admin Only - query matchs for user with provided id'),
  adminVerified: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
});

export const QueryMatchesForCaseSchema = QueryMatchesSchema.omit({
  adminVerified: true,
  maxMatchScore: true,
  status: true,
  minMatchScore: true,
  userId: true,
}).extend({
  minMatchScore: z.coerce.number().min(0).max(1).optional(),
});

export const QueryMatechesForLostCaseSchema = QueryMatchesForCaseSchema.omit({
  foundDocumentCaseId: true,
}).required({ lostDocumentCaseId: true });
export const QueryMatechesForFoundCaseSchema = QueryMatchesForCaseSchema.omit({
  lostDocumentCaseId: true,
}).required({ foundDocumentCaseId: true });

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

const UpdateMatchStatusSchema = z.object({
  status: MatchStatusSchema,
  notes: z.string().optional(),
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

export const RejectMatchSchema = z.object({
  reason: z.enum([
    'OWNERSHIP_DENIED', // User indicates the document does not belong to them.
    'DOCUMENT_SUPERSEDED',
    'OTHER',
  ]),
  comment: z.string().optional(),
});

export class MatchResultDto extends createZodDto(MatchResultSchema) {}

export class QueryMatchesDto extends createZodDto(QueryMatchesSchema) {}

export class UpdateMatchStatusDto extends createZodDto(
  UpdateMatchStatusSchema,
) {}

export class CompleteMatchDto extends createZodDto(CompleteMatchSchema) {}

export class AdminVerifyMatchDto extends createZodDto(AdminVerifyMatchSchema) {}
export class QueryMatechesForLostCaseDto extends createZodDto(
  QueryMatechesForLostCaseSchema,
) {}
export class QueryMatechesForFoundCaseDto extends createZodDto(
  QueryMatechesForFoundCaseSchema,
) {}

export class GetMatchResponseDto implements Match {
  @ApiProperty()
  id: string;
  @ApiProperty()
  lostDocumentCaseId: string;
  @ApiProperty()
  foundDocumentCaseId: string;
  @ApiProperty()
  matchScore: number;
  @ApiProperty({ enum: MatchStatus })
  status: MatchStatus;
  @ApiProperty()
  matchNumber: string;
  @ApiProperty()
  aiInteractionId: string;
  @ApiProperty({ type: MatchResultDto })
  aiAnalysis: JsonValue;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  notifiedAt: Date | null;
  @ApiProperty()
  viewedAt: Date | null;
  @ApiProperty()
  voided: boolean;
}

export class QueryMatchesResponseDto {
  @ApiProperty({ isArray: true, type: GetMatchResponseDto })
  results: GetMatchResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  currentPage: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  next: string | null;

  @ApiProperty()
  prev: string | null;
}

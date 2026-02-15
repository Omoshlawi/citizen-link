import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import { Claim, ClaimStatus } from '../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export const ClaimSchema = z.object({
  pickupStationId: z.uuid().optional(),
  matchId: z.uuid(),
  preferredHandoverDate: z.iso.date().optional(),
  securityQuestions: z
    .object({
      question: z.string(),
      response: z.string().nonempty(),
    })
    .array()
    .min(4),
  attachments: z.string().nonempty().array().nonempty().max(1),
});

export const ClaimVerificationSchema = z.object({
  overallConfidence: z.coerce.number().min(0).max(100),
  verified: z.boolean(),
  reasoning: z.string().nonempty(),
  questions: z
    .object({
      question: z.string().nonempty(),
      espected: z.string().nonempty(),
      provided: z.string().nonempty(),
      confidence: z.string().nonempty().min(0).max(100),
      reasoning: z.string().nonempty(),
      correct: z.boolean(),
    })
    .array()
    .min(4),
});

export const QueryClaimSchema = z.object({
  ...QueryBuilderSchema.shape,
  claimNumber: z.coerce.number().optional(),
  userId: z
    .uuid()
    .optional()
    .describe('Admin Only - Search claims for specified user'),
  foundDocumentCaseId: z.uuid().optional(),
  matchId: z.uuid().optional(),
  caseId: z.uuid().optional(),
  pickupStationId: z.uuid().optional(),
  preferredHandoverDateFrom: z.iso.date().optional(),
  preferredHandoverDateTo: z.iso.date().optional(),
  createdAtFrom: z.iso.date().optional(),
  createdAtTo: z.iso.date().optional(),
  status: z
    .enum(['PENDING', 'VERIFIED', 'REJECTED', 'CANCELLED', 'DISPUTED'])
    .optional(),
});

export class CreateClaimDto extends createZodDto(
  ClaimSchema.pick({
    matchId: true,
    securityQuestions: true,
    attachments: true,
  }),
) {}
export class QueryClaimDto extends createZodDto(QueryClaimSchema) {}
export class ClaimVerificationDto extends createZodDto(
  ClaimVerificationSchema,
) {}
export class UpdateClaimDto extends createZodDto(
  ClaimSchema.pick({ pickupStationId: true, preferredHandoverDate: true }),
) {}

export class GetClaimResponseDto implements Claim {
  @ApiProperty({ required: false })
  pickupStationId: string | null;
  @ApiProperty({ required: false })
  matchId: string;
  @ApiProperty({ required: false })
  preferredHandoverDate: Date | null;
  @ApiProperty({ type: 'number' })
  claimNumber: number;
  @ApiProperty()
  userId: string;
  @ApiProperty()
  foundDocumentCaseId: string;
  @ApiProperty({ enum: ClaimStatus })
  status: ClaimStatus;
  @ApiProperty()
  id: string;
  @ApiProperty()
  serviceFee: number;
  @ApiProperty()
  finderReward: number;
  @ApiProperty()
  totalAmount: number;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}

export class QueryClaimResponseDto {
  @ApiProperty({ isArray: true, type: GetClaimResponseDto })
  results: GetClaimResponseDto[];

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

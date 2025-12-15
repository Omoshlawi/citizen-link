import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  ActorType,
  CaseStatusTransition,
  CaseType,
} from '../../generated/prisma/client';
import { QueryBuilderSchema } from '../query-builder';

export const QueryStatusTransitionDtoSchema = z.object({
  ...QueryBuilderSchema.shape,
  caseId: z.uuid().optional(),
  caseType: z.enum(['LOST', 'FOUND']).optional(),
  actorType: z.enum(['USER', 'ADMIN', 'DEVICE', 'SYSTEM']).optional(),
  actorId: z.string().optional(),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
});

export class QueryStatusTransitionDto extends createZodDto(
  QueryStatusTransitionDtoSchema,
) {}

export enum CaseStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export class GetCaseStatusTransitionResponseDto
  implements CaseStatusTransition
{
  @ApiProperty({ enum: CaseStatus })
  fromStatus: string;
  @ApiProperty({ enum: CaseStatus })
  toStatus: string;
  @ApiProperty()
  id: string;
  @ApiProperty()
  caseId: string;
  @ApiProperty({ enum: CaseType })
  caseType: CaseType;
  @ApiProperty({ enum: ActorType })
  actorType: ActorType;
  @ApiProperty()
  actorId: string;
  @ApiProperty()
  actorName: string | null;
  @ApiProperty()
  deviceId: string | null;
  @ApiProperty()
  deviceLocation: string | null;
  @ApiProperty()
  deviceMetadata: any;
  @ApiProperty()
  verificationResult: any;
  @ApiProperty()
  notes: string;
  @ApiProperty()
  metadata: any;
  @ApiProperty()
  createdAt: Date;
}
export class GetCaseStatusTransitionHistoryResponseDto {
  @ApiProperty({ isArray: true, type: GetCaseStatusTransitionResponseDto })
  results: GetCaseStatusTransitionResponseDto[];

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

export class GetCaseCurrentStatusResponseDto {
  @ApiProperty({ enum: CaseType })
  caseType: CaseType;
  @ApiProperty({ enum: CaseStatus })
  status: CaseStatus;
  @ApiProperty()
  caseId: string;
}

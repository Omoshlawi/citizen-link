import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../query-builder';
import z from 'zod';
import {
  CaseDocumentSchema,
  GetCaseDocumentResponseDto,
} from '../case-documents/case-documents.dto';
import { QueryAddressSchema } from '../address/address.dto';
import { ApiProperty } from '@nestjs/swagger';
import {
  DocumentCase,
  FoundDocumentCase,
  FoundDocumentCaseStatus,
  LostDocumentCase,
  LostDocumentCaseStatus,
} from '../../generated/prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';

export const QueryDocumentCaseSchema = z
  .object({
    ...QueryBuilderSchema.shape,
    search: z.string().optional(),
    documentType: z.uuid().optional(),
    caseType: z.enum(['FOUND', 'LOST']).optional(),
    ownerName: z.string().optional(),
    eventDateFrom: z.iso.date().optional(),
    eventDateTo: z.iso.date().optional(),
    dateReportedFrom: z.iso.date().optional(),
    dateReportedTo: z.iso.date().optional(),
    tags: z.string().array().optional(),
    documentIssuer: z.string().optional(),
    documentNumber: z.string().optional(),
    docuemtExpiryDateFrom: z.iso.date().optional(),
    docuemtExpiryDateTo: z.iso.date().optional(),
    docuemtIssueDateFrom: z.iso.date().optional(),
    docuemtIssueDateTo: z.iso.date().optional(),
    includeVoided: z
      .stringbool({
        truthy: ['true', '1'],
        falsy: ['false', '0'],
      })
      .optional()
      .default(false),
    includeForOtherUsers: z // TODO:  validate only for admin users else throw forbidden error
      .stringbool({
        truthy: ['true', '1'],
        falsy: ['false', '0'],
      })
      .optional()
      .default(false),
  })
  .merge(
    QueryAddressSchema.pick({
      level1: true,
      level2: true,
      level3: true,
      level4: true,
      level5: true,
      country: true,
      postalCode: true,
      location: true,
    }),
  );

export const DocumentCaseSchema = z.object({
  documentId: z.string().min(1),
  addressId: z.string().min(1),
  description: z.string().optional(),
  eventDate: z.iso.date(),
  tags: z.string().min(1).array().optional(),
  status: z.enum([
    'ACTIVE',
    'MATCHED',
    'RETURNED',
    'EXPIRED',
    'CLAIMED',
    'PENDING_VERIFICATION',
    'ARCHIVED',
  ]),
});

export const FoundDocumentCaseSchema = z.object({
  addressId: z.uuid(),
  eventDate: z.iso.date(),
  tags: z.string().min(1).array().optional(),
  description: z.string().optional(),
  images: z.string().nonempty().array().nonempty().max(2),
});

export const LostDocumentCaseSchema = FoundDocumentCaseSchema.merge(
  CaseDocumentSchema,
).omit({ images: true });

export class QueryDocumentCaseDto extends createZodDto(
  QueryDocumentCaseSchema,
) {}

export class CreateFoundDocumentCaseDto extends createZodDto(
  FoundDocumentCaseSchema,
) {}

export class CreateLostDocumentCaseDto extends createZodDto(
  LostDocumentCaseSchema,
) {}

export class UpdateDocumentCaseDto extends createZodDto(
  FoundDocumentCaseSchema.omit({ images: true }).partial(),
) {}

export class LostDocumentCaseResponseDto implements LostDocumentCase {
  @ApiProperty()
  id: string;
  @ApiProperty()
  caseId: string;
  @ApiProperty({ enum: LostDocumentCaseStatus })
  status: LostDocumentCaseStatus;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}

export class SecurityQuestionDto {
  @ApiProperty()
  question: string;
  @ApiProperty()
  answer: string;
}

export class FoundDocumentCaseResponseDto implements FoundDocumentCase {
  @ApiProperty()
  pickupStationId: string | null;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  pointAwarded: number;
  @ApiProperty({ isArray: true, type: SecurityQuestionDto })
  securityQuestion: JsonValue;
  @ApiProperty()
  id: string;
  @ApiProperty()
  caseId: string;
  @ApiProperty({ enum: FoundDocumentCaseStatus })
  status: FoundDocumentCaseStatus;
}

export class GetDocumentCaseResponseDto implements DocumentCase {
  @ApiProperty()
  addressId: string;
  @ApiProperty()
  description: string | null;
  @ApiProperty()
  eventDate: Date;
  @ApiProperty()
  tags: Array<string>;
  @ApiProperty()
  id: string;
  @ApiProperty()
  userId: string;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  voided: boolean;
  @ApiProperty({ type: LostDocumentCaseResponseDto })
  lostDocumentCase: LostDocumentCaseResponseDto;
  @ApiProperty({ type: FoundDocumentCaseResponseDto })
  foundDocumentCase: FoundDocumentCaseResponseDto;
  @ApiProperty({ type: GetCaseDocumentResponseDto })
  document: GetCaseDocumentResponseDto;
}

export class QueryDocumentCaseResponseDto {
  @ApiProperty({ isArray: true, type: GetDocumentCaseResponseDto })
  results: GetDocumentCaseResponseDto[];
  @ApiProperty()
  totalCount: number;
  @ApiProperty()
  totalPages: number;
  @ApiProperty()
  currentPage: number;
  @ApiProperty()
  pageSize: number;
  @ApiProperty({ type: 'string' })
  next: string | null;
  @ApiProperty({ type: 'string' })
  prev: string | null | undefined;
}

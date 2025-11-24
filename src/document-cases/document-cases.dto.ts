import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../query-builder';
import z from 'zod';
import { DocumentSchema } from '../documents/documents.dto';
import { QueryAddressSchema } from '../address/address.dto';
import { ApiProperty } from '@nestjs/swagger';
import {
  DocumentCase,
  DocumentCaseStatus,
} from '../../generated/prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';

export const QueryDocumentCaseSchema = z
  .object({
    ...QueryBuilderSchema.shape,
    search: z.string().optional(),
    documentType: z.uuid().optional(),
    caseType: z.enum(['FOUND', 'LOST']).optional(),
    ownerName: z.string().optional(),
    dateLostOrFoundFrom: z.iso.date().optional(),
    dateLostOrFoundTo: z.iso.date().optional(),
    dateReportedFrom: z.iso.date().optional(),
    dateReportedTo: z.iso.date().optional(),
    tags: z.string().array().optional(),
    //   TODO: Add address search filters
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

export const LostDocumentCaseSchema = z.object({
  reportId: z.uuid(),
});

export const FoundDocumentCaseSchema = z.object({
  reportId: z.uuid(),
  securityQuestion: z.string().optional().optional(),
  securityAnswer: z.string().optional().optional(),
});

const _ReportDocumentCaseSchema = DocumentCaseSchema.omit({
  documentId: true,
  status: true,
}).extend({
  type: z.enum(['LOST', 'FOUND']),
  document: DocumentSchema,
  lost: LostDocumentCaseSchema.omit({ reportId: true }).optional(),
  found: FoundDocumentCaseSchema.omit({ reportId: true }).optional(),
});

export const ReportDocumentCaseSchema = {
  partial: _ReportDocumentCaseSchema
    .partial()
    .refine(
      (data) => {
        if (data.type === 'LOST') return data.lost !== undefined;
        return true;
      },
      {
        message: 'Lost details are required when type is LOST',
        path: ['lost'],
      },
    )
    .refine(
      (data) => {
        if (data.type === 'FOUND') return data.found !== undefined;
        return true;
      },
      {
        message: 'Found details are required when type is FOUND',
        path: ['found'],
      },
    ),
  required: _ReportDocumentCaseSchema
    .refine(
      (data) => {
        if (data.type === 'LOST') return data.lost !== undefined;
        return true;
      },
      {
        message: 'Lost details are required when type is LOST',
        path: ['lost'],
      },
    )
    .refine(
      (data) => {
        if (data.type === 'FOUND') return data.found !== undefined;
        return true;
      },
      {
        message: 'Found details are required when type is FOUND',
        path: ['found'],
      },
    ),
};

export class QueryDocumentCaseDto extends createZodDto(
  QueryDocumentCaseSchema,
) {}

export class CreateDocumentCaseDto extends createZodDto(
  ReportDocumentCaseSchema.required,
) {}

export class UpdateDocumentCaseDto extends createZodDto(
  ReportDocumentCaseSchema.partial,
) {}

export class GetDocumentCaseResponseDto implements DocumentCase {
  @ApiProperty()
  addressId: string;
  @ApiProperty()
  description: string | null;
  @ApiProperty()
  eventDate: Date;
  @ApiProperty()
  tags: JsonValue;
  @ApiProperty()
  status: DocumentCaseStatus;
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

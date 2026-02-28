import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder/query-builder.utils';
import z from 'zod';
import { DocumentCategory, DocumentType } from '../../generated/prisma/browser';
import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/client';

export enum DocumentTypeCode {
  NATIONAL_ID = 'NATIONAL_ID',
  PASSPORT = 'PASSPORT',
  BIRTH_CERT = 'BIRTH_CERT',
  ALIEN_REGISTRATION_CARD = 'ALIEN_REGISTRATION_CARD',
  SOCIAL_SECURITY_CARD = 'SOCIAL_SECURITY_CARD',
  MARRIAGE_CERT = 'MARRIAGE_CERT',
  DRIVING_LICENCE = 'DRIVING_LICENCE',
  PROFESSIONAL_LICENSE = 'PROFESSIONAL_LICENSE',
  WORK_ID = 'WORK_ID',
  STUDENT_ID = 'STUDENT_ID',
  HEALTH_INSURANCE_CARD = 'HEALTH_INSURANCE_CARD',
  UNKNOWN = 'UNKNOWN',
}

export const QueryDocumentTypeSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z.string().optional(),
  code: z.enum(DocumentTypeCode).optional(),
  category: z
    .enum([
      'IDENTITY',
      'ACADEMIC',
      'PROFESSIONAL',
      'VEHICLE',
      'FINANCIAL',
      'MEDICAL',
      'LEGAL',
      'OTHER',
    ])
    .optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
});

export const DocumentTypeSchema = z.object({
  name: z.string().min(1),
  category: z.enum([
    'IDENTITY',
    'ACADEMIC',
    'PROFESSIONAL',
    'VEHICLE',
    'FINANCIAL',
    'MEDICAL',
    'LEGAL',
    'OTHER',
  ]),
  code: z.enum(DocumentTypeCode),
  description: z.string().nullable().optional(),
  icon: z.string().min(1, 'Icon required').optional(),
  loyaltyPoints: z.coerce.number(),
  serviceFee: z.coerce.number(),
  finderReward: z.coerce.number(),
  currency: z.string().min(1, 'Currency required').optional(),
  replacementInstructions: z.string().optional(),
  averageReplacementCost: z.coerce.number().optional(),
});

export class CreateDocumentTypeDto extends createZodDto(DocumentTypeSchema) {}

export class UpdateDocumentTypeDto extends createZodDto(
  DocumentTypeSchema.partial(),
) {}

export class QueryDocumentTypeDto extends createZodDto(
  QueryDocumentTypeSchema,
) {}

export class GetDocumentTypeResponseDto implements DocumentType {
  @ApiProperty({ enum: DocumentTypeCode })
  code: DocumentTypeCode;
  @ApiProperty()
  serviceFee: Decimal;
  @ApiProperty()
  finderReward: Decimal;
  @ApiProperty()
  totalAmount: Decimal;
  @ApiProperty()
  currency: string;
  @ApiProperty()
  aiExtractionPrompt: string | null;
  @ApiProperty()
  verificationStrategy: any;
  @ApiProperty()
  category: DocumentCategory;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string | null;

  @ApiProperty()
  icon: string | null;

  @ApiProperty()
  loyaltyPoints: number;

  @ApiProperty()
  replacementInstructions: string | null;

  @ApiProperty()
  averageReplacementCost: number | null;

  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  voided: boolean;
}

export class QueryDocumentTypeResponseDto {
  @ApiProperty({ isArray: true, type: GetDocumentTypeResponseDto })
  results: GetDocumentTypeResponseDto[];

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

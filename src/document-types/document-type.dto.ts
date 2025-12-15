import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../query-builder/query-builder.utils';
import z from 'zod';
import { DocumentCategory, DocumentType } from '../../generated/prisma/browser';
import { ApiProperty } from '@nestjs/swagger';

export const QueryDocumentTypeSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z.string().optional(),
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
  description: z.string().nullable().optional(),
  icon: z.string().min(1, 'Icon required').optional(),
  loyaltyPoints: z.coerce.number(),
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

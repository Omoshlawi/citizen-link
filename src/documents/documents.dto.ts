import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../query-builder';
import z from 'zod';
import { Document } from '../../generated/prisma/browser';
import { ApiProperty } from '@nestjs/swagger';

export const QueryDocumentSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z.string().optional(),
  documentNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  batchNumber: z.string().optional(),
  issuer: z.string().optional(),
  ownerName: z.string().optional(),
  dateOfBirth: z.iso.date().optional(),
  placeOfBirth: z.string().optional(),
  placeOfIssue: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Unknown']).optional(),
  nationality: z.string().optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
});

export const DocumentImageSchema = z
  .object({
    url: z.string().min(1, 'Required'),
    imageType: z.enum(['FRONT', 'BACK', 'FULL']).optional(),
    ocrText: z.string().optional(),
  })
  .array();

export const DocumentFieldSchema = z.object({
  documentId: z.string().uuid(),
  fieldName: z.string().min(1, 'Required'),
  fieldValue: z.string().min(1, 'Required'), // All values stored as strings and converted as needed
});

export const DocumentSchema = z.object({
  serialNumber: z.string().optional(), // Secondary identifier like serial number if present
  documentNumber: z.string().optional(), // Generic document number (ID number, passport number, etc.)
  batchNumber: z.string().optional(), // Batch number if available
  issuer: z.string().optional(),
  ownerName: z.string().min(1, 'Owner name required'),
  dateOfBirth: z.iso.date().optional(), // Owner's date of birth
  placeOfBirth: z.string().optional(), // Owner's place of birth
  placeOfIssue: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Unknown']).optional(), // Owner's gender
  nationality: z.string().optional(),
  note: z.string().optional(), // Additional notes, could be also any identifying marks on document as well, any instruction,e.t.c
  typeId: z.string().min(1, 'Type required'),
  issuanceDate: z.iso.date().optional(),
  expiryDate: z.iso.date().optional(),
  images: DocumentImageSchema.optional(),
  additionalFields: DocumentFieldSchema.omit({ documentId: true })
    .array()
    .optional(),
});

export class CreateDocumentDto extends createZodDto(DocumentSchema) {}

export class UpdateDocumentDto extends createZodDto(DocumentSchema.partial()) {}

export class QueryDocumentDto extends createZodDto(QueryDocumentSchema) {}

export class GetDocumentResponseDto implements Document {
  @ApiProperty()
  caseId: string;
  @ApiProperty()
  documentNumber: string | null;
  @ApiProperty()
  serialNumber: string | null;
  @ApiProperty()
  batchNumber: string | null;
  @ApiProperty()
  issuer: string | null;
  @ApiProperty()
  ownerName: string;
  @ApiProperty()
  dateOfBirth: Date | null;
  @ApiProperty()
  placeOfBirth: string | null;
  @ApiProperty()
  placeOfIssue: string | null;
  @ApiProperty()
  gender: string | null;
  @ApiProperty()
  nationality: string | null;
  @ApiProperty()
  note: string | null;
  @ApiProperty()
  typeId: string;
  @ApiProperty()
  issuanceDate: Date | null;
  @ApiProperty()
  expiryDate: Date | null;
  @ApiProperty()
  id: string;
  @ApiProperty()
  reportId: string;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  voided: boolean;
}

export class QueryDocumentResponseDto {
  @ApiProperty({ isArray: true, type: GetDocumentResponseDto })
  results: GetDocumentResponseDto[];

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

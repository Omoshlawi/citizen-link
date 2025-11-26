import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../query-builder';
import z from 'zod';
import { Image } from '../../generated/prisma/browser';
import { JsonValue } from '@prisma/client/runtime/library';
import { ApiProperty } from '@nestjs/swagger';

export const QueryDocumentImageSchema = z.object({
  ...QueryBuilderSchema.shape,
  imageType: z.enum(['FRONT', 'BACK', 'FULL']).optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
});

export const DocumentImageItemSchema = z.object({
  url: z.url(),
  imageType: z.enum(['FRONT', 'BACK', 'FULL']).optional(),
});

export const DocumentImageSchema = z.object({
  images: DocumentImageItemSchema.array(),
});

export class QueryDocumentImageDto extends createZodDto(
  QueryDocumentImageSchema,
) {}

export class CreateDocumentImageDto extends createZodDto(DocumentImageSchema) {}

export class GetDocumentImageResponseDto implements Image {
  @ApiProperty()
  imageType: string | null;
  @ApiProperty()
  url: string;
  @ApiProperty()
  id: string;
  @ApiProperty()
  documentId: string | null;
  @ApiProperty()
  metadata: JsonValue;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  voided: boolean;
}

export class CreateDocumentImageResponseDto {
  @ApiProperty({ isArray: true, type: GetDocumentImageResponseDto })
  images: GetDocumentImageResponseDto[];
}

export class QueryDocumentImageResponseDto {
  @ApiProperty({ isArray: true, type: GetDocumentImageResponseDto })
  results: GetDocumentImageResponseDto[];
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

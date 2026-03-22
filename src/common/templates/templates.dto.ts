import z from 'zod';
import { TemplateType } from './templates.interfaces';
import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../query-builder';
import { Template, TemplateVersion } from '../../../generated/prisma/client';
import { JsonValue } from '@prisma/client/runtime/client';
import { ApiProperty } from '@nestjs/swagger';

export const TemplateShema = z.object({
  key: z.string().nonempty('Key is required'),
  type: z.enum(TemplateType),
  name: z.string().nonempty('Name is required'),
  description: z.string().optional(),
  slots: z.record(z.string(), z.string()),
  schema: z.object({
    required: z.string().array(),
    optional: z.string().array(),
  }),
  metadata: z.record(z.string(), z.any()),
});

export const RenderTemplateSchema = z.object({
  data: z.record(z.string(), z.any()),
});

export const QueryTemplateSchema = z.object({
  ...QueryBuilderSchema.shape,
  type: z.enum(TemplateType).optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
  search: z.string().optional(),
});

export const QueryTemplateVersionSchema = z.object({
  ...QueryBuilderSchema.shape,
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
});

export class QueryTemplateDto extends createZodDto(QueryTemplateSchema) {}

export class QueryTemplateVersionDto extends createZodDto(
  QueryTemplateVersionSchema,
) {}

export class CreateTemplateDto extends createZodDto(TemplateShema) {}
export class RenderTemplateDto extends createZodDto(RenderTemplateSchema) {}

export class UpdateTemplateDto extends createZodDto(
  TemplateShema.extend({ changeNote: z.string().optional() }).partial(),
) {}
export class UpdateTemplateByKeyDto extends createZodDto(
  TemplateShema.omit({ key: true })
    .extend({ changeNote: z.string().optional() })
    .partial(),
) {}

class TemplateSchemaDto extends createZodDto(z.object({})) {}
class TemplateSlotsDto extends createZodDto(z.object({})) {}
class TemplateMetadataDto extends createZodDto(z.object({})) {}

export class GetTemplateResponseDto implements Template {
  @ApiProperty()
  key: string;
  @ApiProperty({ enum: TemplateType })
  type: string;
  @ApiProperty()
  name: string;
  @ApiProperty({ nullable: true })
  description: string | null;
  @ApiProperty({ type: TemplateSlotsDto })
  slots: JsonValue;
  @ApiProperty({
    nullable: true,
    type: TemplateSchemaDto,
  })
  schema: JsonValue;
  @ApiProperty({
    nullable: true,
    type: TemplateMetadataDto,
  })
  metadata: JsonValue;
  @ApiProperty()
  id: string;
  @ApiProperty()
  engine: string;
  @ApiProperty()
  voided: boolean;
  @ApiProperty()
  version: number;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}

export class TemplateVersionResponseDto implements TemplateVersion {
  @ApiProperty()
  id: string;
  @ApiProperty()
  templateId: string;
  @ApiProperty()
  version: number;
  @ApiProperty({ type: TemplateSlotsDto })
  slots: JsonValue;
  @ApiProperty({ type: TemplateSchemaDto })
  schema: JsonValue;
  @ApiProperty({ type: TemplateMetadataDto })
  metadata: JsonValue;
  @ApiProperty()
  changedById: string;
  @ApiProperty()
  changeNote: string;
  @ApiProperty()
  createdAt: Date;
}

export class QueryTemplateResponseDto {
  @ApiProperty({ isArray: true, type: GetTemplateResponseDto })
  results: GetTemplateResponseDto[];

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
export class QueryTemplateVersionResponseDto {
  @ApiProperty({ isArray: true, type: TemplateVersionResponseDto })
  results: TemplateVersionResponseDto[];

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

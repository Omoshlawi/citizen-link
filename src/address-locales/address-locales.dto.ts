import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import { QueryBuilderSchema } from '../common/query-builder';

const LocaleLevelSpecSchema = z.object({
  level: z.enum(['level1', 'level2', 'level3', 'level4', 'level5']).optional(),
  label: z.string().min(2),
  description: z.string().optional(),
  required: z.boolean().optional().default(false),
  aliases: z.array(z.string().min(1)).optional(),
});

const LocaleFormatSpecSchema = z.object({
  displayTemplate: z
    .string()
    .describe('Template for rendering addresses')
    .optional(),
  levels: z
    .array(LocaleLevelSpecSchema)
    .min(1)
    .describe('Defines the labels for each hierarchical level'),
  postalCode: z
    .object({
      label: z.string().min(2),
      required: z.boolean().optional(),
      description: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const LocaleExampleSchema = z.object({
  label: z.string().min(2),
  address: z.object({
    address1: z.string().optional(),
    address2: z.string().optional(),
    landmark: z.string().optional(),
    level1: z.string().optional(),
    level2: z.string().optional(),
    level3: z.string().optional(),
    level4: z.string().optional(),
    level5: z.string().optional(),
    cityVillage: z.string().optional(),
    stateProvince: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    plusCode: z.string().optional(),
    formatted: z.string().optional(),
    localeId: z.string().optional(),
  }),
  notes: z.string().optional(),
});

export const AddressLocaleSchema = z.object({
  code: z
    .string()
    .min(2)
    .describe('Unique code for the locale e.g. us-default'),
  country: z
    .string()
    .length(2)
    .transform((val) => val.toUpperCase()),
  regionName: z.string().min(2),
  description: z.string().optional(),
  formatSpec: LocaleFormatSpecSchema,
  examples: z.array(LocaleExampleSchema).optional(),
  tags: z.array(z.string().min(1)).optional(),
  voided: z.boolean().optional(),
});

export const QueryAddressLocaleSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z.string().optional(),
  country: z.string().optional(),
  code: z.string().optional(),
  tag: z.string().optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
});

export class CreateAddressLocaleDto extends createZodDto(
  AddressLocaleSchema.omit({ voided: true }),
) {}

export class UpdateAddressLocaleDto extends createZodDto(
  AddressLocaleSchema.omit({ code: true }).partial(),
) {}

export class QueryAddressLocaleDto extends createZodDto(
  QueryAddressLocaleSchema,
) {}

export class GetAddressLocaleResponseDto extends CreateAddressLocaleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty()
  voided: boolean;
}

export class QueryAddressLocaleResponseDto {
  @ApiProperty({ isArray: true, type: GetAddressLocaleResponseDto })
  results: GetAddressLocaleResponseDto[];

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

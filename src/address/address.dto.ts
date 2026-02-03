import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';

export const QueryAddressSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z
    .string()
    .optional()
    .describe("Only search the 'label' and 'formatted' fields"),
  location: z
    .string()
    .optional()
    .describe('Keyword to search across address levels'),
  type: z
    .enum([
      'HOME',
      'WORK',
      'BILLING',
      'SHIPPING',
      'OFFICE',
      'BRANCH',
      'WAREHOUSE',
      'OTHER',
    ])
    .optional(),
  level1: z.string().optional(),
  level2: z.string().optional(),
  level3: z.string().optional(),
  level4: z.string().optional(),
  level5: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  startDateFrom: z.iso.date().optional(),
  startDateTo: z.iso.date().optional(),
  endDateFrom: z.iso.date().optional(),
  endDateTo: z.iso.date().optional(),
  createdAtFrom: z.iso.date().optional(),
  createdAtTo: z.iso.date().optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
  localeId: z.string().uuid().optional(),
});

export const AddressSchema = z.object({
  type: z.enum(['HOME', 'WORK', 'BILLING', 'SHIPPING', 'OFFICE', 'OTHER']),
  label: z.string().optional(),
  address1: z.string(),
  address2: z.string().optional(),
  landmark: z.string().optional(),
  level1: z.string(),
  level2: z.string().optional(),
  level3: z.string().optional(),
  level4: z.string().optional(),
  level5: z.string().optional(),
  cityVillage: z.string().optional(),
  stateProvince: z.string().optional(),
  country: z.string(),
  postalCode: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  plusCode: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  preferred: z.boolean().optional(),
  formatted: z.string().optional(),
  localeId: z.uuid().optional(),
});

export class QueryAddressDto extends createZodDto(QueryAddressSchema) {}

export class CreateAddressDto extends createZodDto(AddressSchema) {}

export class UpdateAddressDto extends createZodDto(AddressSchema.partial()) {}

export class GetAddressResponseDto extends CreateAddressDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  voided: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class QueryAddressResponseDto {
  @ApiProperty({ isArray: true, type: GetAddressResponseDto })
  results: GetAddressResponseDto[];

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

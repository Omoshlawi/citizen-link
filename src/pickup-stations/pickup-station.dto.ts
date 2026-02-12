import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import { PHONE_NUMBER_REGEX } from '../app.constant';

export const QueryPickupAddressSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z
    .string()
    .optional()
    .describe("Only search the 'label' and 'formatted' fields"),
  location: z
    .string()
    .optional()
    .describe('Keyword to search across address levels'),
  level1: z.string().optional(),
  level2: z.string().optional(),
  level3: z.string().optional(),
  level4: z.string().optional(),
  level5: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  code: z.string().optional(),
  createdAtFrom: z.iso.date().optional(),
  createdAtTo: z.iso.date().optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
  addressLocaleCode: z.string().optional(),
});

export const PickUpStationSchema = z.object({
  code: z.string(),
  name: z.string(),
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
  phoneNumber: z.string().regex(PHONE_NUMBER_REGEX).optional(),
  email: z.email().optional(),
  addressLocaleCode: z.string(),
});

export class QueryPickupStationDto extends createZodDto(
  QueryPickupAddressSchema,
) {}

export class CreatePickupStationDto extends createZodDto(PickUpStationSchema) {}

export class UpdatePickupStationDto extends createZodDto(
  PickUpStationSchema.omit({ code: true }).partial(),
) {}

export class GetPickupStationResponseDto extends CreatePickupStationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  voided: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class QueryPickupStationResponseDto {
  @ApiProperty({ isArray: true, type: GetPickupStationResponseDto })
  results: GetPickupStationResponseDto[];

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

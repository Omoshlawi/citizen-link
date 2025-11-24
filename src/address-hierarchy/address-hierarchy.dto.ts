import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import { QueryBuilderSchema } from '../query-builder';
import { AddressHierarchy } from '../../generated/prisma/browser';

export const QueryAddressHierarchySchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z.string().optional(),
  country: z.string().optional(),
  level: z.coerce.number().int().nonnegative().min(1).max(5).optional(),
  code: z.string().optional(),
  parentId: z.uuid().optional(),
  name: z.string().optional(),
  nameLocal: z.string().optional(),
  parentCountry: z.string().optional(),
  parentLevel: z.coerce.number().int().nonnegative().min(1).max(5).optional(),
  parentCode: z.string().optional(),
  parentName: z.string().optional(),
  parentNameLocal: z.string().optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
});

export class QueryAddressHierarchyDto extends createZodDto(
  QueryAddressHierarchySchema,
) {}

export class GetAddressHierarchyResponseDto implements AddressHierarchy {
  @ApiProperty()
  country: string;

  @ApiProperty()
  level: number;

  @ApiProperty()
  parentId: string;

  @ApiProperty({ type: GetAddressHierarchyResponseDto })
  parent?: GetAddressHierarchyResponseDto | undefined;

  @ApiProperty({ isArray: true, type: GetAddressHierarchyResponseDto })
  children: GetAddressHierarchyResponseDto[];

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  nameLocal: string;

  @ApiProperty()
  id: string;

  @ApiProperty()
  voided: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class QueryAddressHierarchyResponseDto {
  @ApiProperty({ isArray: true, type: GetAddressHierarchyResponseDto })
  results: GetAddressHierarchyResponseDto[];

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

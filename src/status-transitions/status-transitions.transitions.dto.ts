import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import { QueryBuilderSchema } from '../common/query-builder';

export const QueryStatusTransitionsSchema = z.object({
  ...QueryBuilderSchema.shape,
  entityId: z.string().optional(),
  entityType: z.string().optional(),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  reasonId: z.uuid().optional(),
  changedById: z.string().optional(),
  search: z.string().optional(),
});

export class QueryStatusTransitionsDto extends createZodDto(
  QueryStatusTransitionsSchema,
) {}

export class GetStatusTransitionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  fromStatus: string;

  @ApiProperty()
  toStatus: string;

  @ApiProperty()
  reasonId: string | null;

  @ApiProperty()
  comment: string | null;

  @ApiProperty()
  changedById: string;

  @ApiProperty()
  createdAt: Date;
}

export class QueryStatusTransitionsResponseDto {
  @ApiProperty({ isArray: true, type: GetStatusTransitionResponseDto })
  results: GetStatusTransitionResponseDto[];

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


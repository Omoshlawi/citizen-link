import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginatedListBase {
  @ApiProperty()
  totalCount!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  currentPage!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiPropertyOptional({ nullable: true })
  next!: string | null;

  @ApiPropertyOptional({ nullable: true })
  prev!: string | null;
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomRepresentationService } from 'src/query-builder/representation.service';
import { PaginationService, SortService } from '../query-builder';
@Injectable()
export class CaseDocumentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}
}

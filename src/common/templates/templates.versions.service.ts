import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../query-builder';
import { QueryTemplateVersionDto } from './templates.dto';

@Injectable()
export class TemplatesVersionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
    private readonly paginationService: PaginationService,
    private readonly sortService: SortService,
  ) {}

  async findOne(
    key: string,
    version: number,
    query: CustomRepresentationQueryDto,
  ) {
    const tpl = await this.prismaService.template.findUnique({
      where: { key, voided: false },
    });
    if (!tpl) {
      throw new BadRequestException(`Template not found: ${key}`);
    }
    const snapshot = await this.prismaService.templateVersion.findUnique({
      where: {
        templateId_version: { templateId: tpl.id, version },
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!snapshot) {
      throw new BadRequestException(`Version not found: ${version}`);
    }
    return snapshot;
  }

  async getVersionHistory(
    key: string,
    query: QueryTemplateVersionDto,
    originalUrl: string,
  ) {
    const dbQuery: Prisma.TemplateVersionWhereInput = {
      template: { key, voided: query?.includeVoided ? undefined : false },
    };
    const totalCount = await this.prismaService.templateVersion.count({
      where: dbQuery,
    });
    const data = await this.prismaService.templateVersion.findMany({
      where: dbQuery,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    });
    return {
      results: data,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RenderedSlots,
  RenderOneResult,
  TemplateType,
} from './templates.interfaces';
import { TemplatesRenderService } from './templates.render.service';
import { Prisma, Template } from '../../../generated/prisma/browser';
import {
  CreateTemplateDto,
  QueryTemplateDto,
  QueryTemplateVersionDto,
  UpdateTemplateDto,
} from './templates.dto';
import { UserSession } from '../..//auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  PaginationService,
  SortService,
} from '../query-builder';
import { TemplatesVersionsService } from './templates.versions.service';

@Injectable()
export class TemplatesService implements OnModuleInit {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly templatesRenderService: TemplatesRenderService,
    private readonly templatesVersionsService: TemplatesVersionsService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  onModuleInit() {
    this.registerHelpers();
  }

  async findVersionHistory(
    key: string,
    query: QueryTemplateVersionDto,
    originalUrl: string,
  ) {
    return this.templatesVersionsService.getVersionHistory(
      key,
      query,
      originalUrl,
    );
  }

  async findVersion(
    key: string,
    version: number,
    query: CustomRepresentationQueryDto,
  ) {
    return this.templatesVersionsService.findOne(key, version, query);
  }

  private async findActive(key: string) {
    const tpl = await this.prismaService.template.findUnique({
      where: { key, voided: false },
    });
    if (!tpl) {
      throw new BadRequestException(`Template not found: ${key}`);
    }
    return tpl;
  }

  async rollback(
    key: string,
    toVersion: number,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const tpl = await this.findActive(key);
    const snapshot = await this.prismaService.templateVersion.findUniqueOrThrow(
      {
        where: {
          templateId_version: { templateId: tpl.id, version: toVersion },
        },
      },
    );

    return this.update(
      key,
      {
        slots: snapshot.slots as Record<string, string>,
        metadata: snapshot.metadata as Record<string, unknown>,
        changeNote: `Rolled back to v${toVersion}`,
      },
      user,
      query,
    );
  }

  async findAll(query: QueryTemplateDto, originalUrl: string) {
    const dbQuery: Prisma.TemplateWhereInput = {
      AND: [
        {
          voided: query?.includeVoided ? undefined : false,
          type: query?.type,
        },
        {
          OR: query.search
            ? [
                {
                  name: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ]
            : undefined,
        },
      ],
    };
    const totalCount = await this.prismaService.template.count({
      where: dbQuery,
    });

    const data = await this.prismaService.template.findMany({
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

  async findOne(key: string, query: CustomRepresentationQueryDto) {
    const data = await this.prismaService.template.findUnique({
      where: { key },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) {
      throw new BadRequestException(`Template not found: ${key}`);
    }
    return data;
  }

  async create(
    createTemplateDto: CreateTemplateDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    // Validate slot contract before saving
    this.templatesRenderService.validateSlots(
      createTemplateDto.type,
      createTemplateDto.slots,
      createTemplateDto.key,
    );

    return this.prismaService.template.create({
      data: {
        ...createTemplateDto,
        version: 1,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async update(
    key: string,
    updateTemplateDto: UpdateTemplateDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const tpl = await this.findActive(key);

    if (updateTemplateDto.slots) {
      this.templatesRenderService.validateSlots(
        tpl.type as TemplateType,
        updateTemplateDto.slots,
        key,
      );
      // Invalidate compiled cache for changed slots
      const old = tpl.slots as Record<string, string>;
      for (const [name, template] of Object.entries(old)) {
        if (updateTemplateDto.slots[name] !== template)
          this.templatesRenderService.compiled.delete(template);
      }
    }

    const newVersion = tpl.version + 1;

    const updated = await this.prismaService.$transaction(async (tx) => {
      // Save new version snapshot
      await tx.templateVersion.create({
        data: {
          templateId: tpl.id,
          version: tpl.version,
          slots: tpl.slots as Record<string, string>,
          schema: tpl.schema ?? undefined,
          metadata: tpl.metadata ?? undefined,
          changedById: user.id,
          changeNote: updateTemplateDto.changeNote,
        },
      });
      // Update the live template
      return await tx.template.update({
        where: { key },
        data: {
          ...(updateTemplateDto.slots && { slots: updateTemplateDto.slots }),
          ...(updateTemplateDto.metadata && {
            metadata: updateTemplateDto.metadata,
          }),
          ...(updateTemplateDto.name && { name: updateTemplateDto.name }),
          ...(updateTemplateDto.description && {
            description: updateTemplateDto.description,
          }),
          version: newVersion,
        } as Prisma.TemplateUpdateInput,
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    });

    return updated;
  }

  async remove(key: string, query: DeleteQueryDto) {
    let data: Template;
    if (query?.purge) {
      data = await this.prismaService.template.delete({
        where: { key },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prismaService.template.update({
        where: { key },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return data;
  }

  async restore(key: string, query: CustomRepresentationQueryDto) {
    const data = await this.prismaService.template.update({
      where: { key },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }

  renderFile(
    category: 'mail' | 'sms' | 'prompts',
    templateName: string,
    data: Record<string, any>,
  ): Promise<string> {
    return this.templatesRenderService.renderFile(category, templateName, data);
  }

  renderString(template: string, data: Record<string, unknown> = {}): string {
    return this.templatesRenderService.renderString(template, data);
  }

  renderAll(
    key: string,
    data: Record<string, unknown> = {},
    options: { validate?: boolean } = {},
  ): Promise<RenderedSlots> {
    return this.templatesRenderService.renderAll(key, data, options);
  }

  renderSlot(
    key: string,
    slotName: string,
    data: Record<string, unknown> = {},
  ): Promise<RenderOneResult> {
    return this.templatesRenderService.renderSlot(key, slotName, data);
  }

  renderSlots(
    key: string,
    slotNames: string[],
    data: Record<string, unknown> = {},
  ): Promise<RenderedSlots> {
    return this.templatesRenderService.renderSlots(key, slotNames, data);
  }

  private registerHelpers() {
    // Register global Handlebars helpers for your AI prompts
    Handlebars.registerHelper('json', (context?: any) =>
      JSON.stringify(context),
    );
    Handlebars.registerHelper('lower', (str?: string) => str?.toLowerCase());
    Handlebars.registerHelper('upper', (s: string) => String(s).toUpperCase());
    Handlebars.registerHelper(
      'safe',
      (value: unknown) => value ?? 'Not provided',
    );
    Handlebars.registerHelper('bool', (value: unknown) =>
      value === true ? 'Yes' : value === false ? 'No' : 'Not provided',
    );
    Handlebars.registerHelper('trim', (s: string) => String(s).trim());
    Handlebars.registerHelper(
      'default',
      (value: unknown, fallback: string) => value ?? fallback,
    );
    Handlebars.registerHelper('date', (d: Date | string, fmt?: string) => {
      const date = new Date(d);
      return date.toLocaleDateString('en-KE', { dateStyle: 'medium' });
    });
    Handlebars.registerHelper('time', (d: Date | string) =>
      new Date(d).toLocaleTimeString('en-KE', { timeStyle: 'short' }),
    );
    Handlebars.registerHelper('currency', (amount: number, currency = 'KES') =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(
        amount,
      ),
    );
    Handlebars.registerHelper('json', (obj: unknown) =>
      JSON.stringify(obj, null, 2),
    );
    Handlebars.registerHelper('truncate', (str: string, len: number) =>
      str?.length > len ? str.slice(0, len) + '…' : str,
    );
    Handlebars.registerHelper(
      'ifEqual',
      function (a: unknown, b: unknown, opts: Handlebars.HelperOptions) {
        return a === b ? opts.fn(this) : opts.inverse(this);
      },
    );
    Handlebars.registerHelper('nl2br', (str: string) =>
      String(str).replace(/\n/g, '<br>'),
    );
    this.logger.log(
      'Handlebars helpers registered: ' +
        Object.keys(Handlebars.helpers).join(', '),
    );
  }
}

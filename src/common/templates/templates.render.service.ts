import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as Handlebars from 'handlebars';
import {
  RenderedSlots,
  RenderOneResult,
  SlotContract,
  TemplateType,
} from './templates.interfaces';
import { CONTRACT_REGISTRY } from './template.constants';

@Injectable()
export class TemplatesRenderService {
  private readonly logger = new Logger(TemplatesRenderService.name);
  // Point to where the CLI copies your assets
  private readonly baseDir = path.join(process.cwd(), 'dist/assets/templates');
  // Compiled Handlebars cache — keyed by the raw template string
  private readonly _compiled = new Map<string, HandlebarsTemplateDelegate>();

  constructor(private readonly prismaService: PrismaService) {}
  private async findActive(key: string) {
    const tpl = await this.prismaService.template.findUnique({
      where: { key, voided: false },
    });
    if (!tpl) {
      throw new BadRequestException(`Template not found: ${key}`);
    }
    return tpl;
  }

  async renderFile(
    category: 'mail' | 'sms' | 'prompts',
    templateName: string,
    data: Record<string, any>,
  ): Promise<string> {
    const filePath = path.join(this.baseDir, category, `${templateName}.hbs`);

    try {
      const source = await fs.readFile(filePath, 'utf8');
      const template = Handlebars.compile(source);
      return template(data);
    } catch (error: any) {
      this.logger.error(`Error loading template: ${filePath}`, error);
      throw new InternalServerErrorException(
        `Template not found: ${category}/${templateName}`,
      );
    }
  }

  /**
   * Render a raw Handlebars string directly — no DB lookup.
   * Useful for one-off rendering without persisting a template.
   */
  renderString(template: string, data: Record<string, unknown> = {}): string {
    return this.compile(template)(data);
  }

  /**
   * Render ALL slots of a template.
   * Used by consumers that need to pick which rendered slots to use.
   *
   * @example — notification consumer
   * const { slots, metadata } = await templates.renderAll('order.confirmed', data);
   * const emailHtml = slots.email_body;
   * const smsText   = slots.sms_body;
   */
  async renderAll(
    key: string,
    data: Record<string, unknown> = {},
    options: { validate?: boolean } = {},
  ): Promise<RenderedSlots> {
    const tpl = await this.findActive(key);
    const rawSlots = tpl.slots as Record<string, string>;

    if (options.validate !== false) {
      this.validateSlots(tpl.type as TemplateType, rawSlots, key);
    }

    const rendered: Record<string, string> = {};

    for (const [name, template] of Object.entries(rawSlots)) {
      rendered[name] = this.compile(template)(data);
    }

    return {
      templateId: tpl.id,
      key: tpl.key,
      type: tpl.type,
      metadata: (tpl.metadata as Record<string, unknown>) ?? null,
      slots: rendered,
    };
  }

  /**
   * Render a SINGLE named slot.
   * Used by consumers that only need one slot (e.g. prompt system message).
   *
   * @example — AI prompt consumer
   * const { rendered } = await templates.renderSlot('summarize.document', 'user', { text });
   */
  async renderSlot(
    key: string,
    slotName: string,
    data: Record<string, unknown> = {},
  ): Promise<RenderOneResult> {
    const tpl = await this.findActive(key);
    const rawSlots = tpl.slots as Record<string, string>;

    if (!(slotName in rawSlots)) {
      throw new NotFoundException(
        `Slot "${slotName}" not found in template "${key}". Available: ${Object.keys(rawSlots).join(', ')}`,
      );
    }

    const rendered = this.compile(rawSlots[slotName])(data);

    return {
      templateId: tpl.id,
      key: tpl.key,
      type: tpl.type,
      metadata: (tpl.metadata as Record<string, unknown>) ?? null,
      rendered,
    };
  }

  /**
   * Render a specific subset of slots.
   * More efficient than renderAll when you only need some slots.
   *
   * @example
   * const { slots } = await templates.renderSlots('order.confirmed', ['sms_body'], data);
   */
  async renderSlots(
    key: string,
    slotNames: string[],
    data: Record<string, unknown> = {},
  ): Promise<RenderedSlots> {
    const tpl = await this.findActive(key);
    const rawSlots = tpl.slots as Record<string, string>;

    const rendered: Record<string, string> = {};
    for (const name of slotNames) {
      if (name in rawSlots) {
        rendered[name] = this.compile(rawSlots[name])(data);
      }
    }

    return {
      templateId: tpl.id,
      key: tpl.key,
      type: tpl.type,
      metadata: (tpl.metadata as Record<string, unknown>) ?? null,
      slots: rendered,
    };
  }

  /**
   * Validate that a slot set satisfies the registered contract for its type.
   * Throws BadRequestException if required slots are missing.
   */
  validateSlots(type: TemplateType, slots: Record<string, string>, key = '') {
    const contract: SlotContract<string> | undefined = CONTRACT_REGISTRY[type];
    if (!contract) {
      this.logger.warn(
        `No contract registered for template type "${type}" (key: "${key}") — skipping validation`,
      );
      return;
    }

    const missing = contract.required.filter((r) => !(r in slots));
    if (missing.length) {
      throw new BadRequestException(
        `Template "${key}" (type: ${type}) is missing required slots: ${missing.join(', ')}`,
      );
    }
  }

  private compile(template: string): HandlebarsTemplateDelegate {
    if (!this._compiled.has(template)) {
      try {
        this._compiled.set(template, Handlebars.compile(template));
      } catch (err: any) {
        throw new BadRequestException(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Invalid Handlebars template: ${err.message}`,
        );
      }
    }
    return this._compiled.get(template)!;
  }

  get compiled() {
    return this._compiled;
  }
}

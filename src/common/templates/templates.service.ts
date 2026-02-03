import {
  Injectable,
  OnModuleInit,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as Handlebars from 'handlebars';

@Injectable()
export class TemplatesService implements OnModuleInit {
  private readonly logger = new Logger(TemplatesService.name);
  // Point to where the CLI copies your assets
  private readonly baseDir = path.join(process.cwd(), 'dist/src/templates');

  onModuleInit() {
    // Register global Handlebars helpers for your AI prompts
    Handlebars.registerHelper('json', (context?: any) =>
      JSON.stringify(context),
    );
    Handlebars.registerHelper('lower', (str?: string) => str?.toLowerCase());
    Handlebars.registerHelper(
      'safe',
      (value: unknown) => value ?? 'Not provided',
    );
  }

  async render(
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
}

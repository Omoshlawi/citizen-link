import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: puppeteer.Browser | null = null;

  async onModuleInit() {
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    this.logger.log('PDF browser instance ready');
  }

  async onModuleDestroy() {
    await this.browser?.close();
    this.browser = null;
  }

  async generatePdf(
    html: string,
    options?: puppeteer.PDFOptions,
  ): Promise<Buffer> {
    if (!this.browser) {
      throw new InternalServerErrorException('PDF browser is not initialised');
    }
    const page = await this.browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ printBackground: true, ...options });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }
}

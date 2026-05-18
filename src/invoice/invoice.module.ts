import { Module } from '@nestjs/common';
import { PdfModule } from '../common/pdf/pdf.module';
import { TemplatesModule } from '../common/templates/templates.module';
import { InvoiceController } from './invoice.controller';
import { InvoicePdfService } from './invoice.pdf.service';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [TemplatesModule, PdfModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoicePdfService],
  exports: [InvoiceService],
})
export class InvoiceModule {}

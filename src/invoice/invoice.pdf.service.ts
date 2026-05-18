import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import { TemplatesService } from '../common/templates/templates.service';
import { PdfService } from '../common/pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegionService } from '../region/region.service';

@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly pdfService: PdfService,
    private readonly regionService: RegionService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}

  async generatePdf(
    id: string,
    user: UserSession['user'],
  ): Promise<{ buffer: Buffer; invoiceNumber: string }> {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { invoice: ['list-any'] } },
    });

    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id,
        claim: { userId: isAdmin ? undefined : user.id },
      },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        claim: {
          include: {
            user: { select: { name: true, email: true } },
            foundDocumentCase: {
              select: {
                case: {
                  select: {
                    document: {
                      select: { type: { select: { name: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    const data = {
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: this.regionService.formatDate(invoice.createdAt),
      dueDate: invoice.dueDate
        ? this.regionService.formatDate(invoice.dueDate)
        : '',
      status: invoice.status,
      recipientName: invoice.claim.user.name ?? 'Unknown',
      recipientEmail: invoice.claim.user.email ?? '',
      claimNumber: invoice.claim.claimNumber,
      docTypeName:
        invoice.claim.foundDocumentCase?.case?.document?.type?.name ??
        'Document',
      items: invoice.items.map((item) => ({
        label: item.label,
        description: item.description ?? '',
        type: item.type.replace(/_/g, ' '),
        amount: item.amount.toNumber(),
      })),
      totalAmount: invoice.totalAmount.toNumber(),
      amountPaid: invoice.amountPaid.toNumber(),
      balanceDue: invoice.balanceDue.toNumber(),
    };

    const { rendered: html } = await this.templates.renderSlot(
      'document.print.invoice',
      'content',
      data,
    );
    const buffer = await this.pdfService.generatePdf(html, {
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return { buffer, invoiceNumber: invoice.invoiceNumber };
  }
}

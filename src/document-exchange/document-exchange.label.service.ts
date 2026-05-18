import { Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { AppConfig } from '../app.config';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExchangeMethod,
  VerificationStatus,
} from '../../generated/prisma/client';
import { GetDeliveryLabelQueryDto } from './document-exchange.dto';
import { TemplatesService } from '../common/templates/templates.service';
import { PdfService } from '../common/pdf/pdf.service';

@Injectable()
export class DocumentExchangeLabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfig,
    private readonly templates: TemplatesService,
    private readonly pdfService: PdfService,
  ) {}

  async getLabel(dto: GetDeliveryLabelQueryDto): Promise<Buffer> {
    const exchange = await this.prisma.documentExchange.findUnique({
      where: { exchangeNumber: dto.exchangeNumber },
      include: {
        verifications: {
          where: { status: VerificationStatus.PENDING },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        claim: {
          include: {
            user: { select: { name: true } },
          },
        },
        foundCase: {
          include: {
            case: { include: { document: { include: { type: true } } } },
          },
        },
      },
    });

    if (!exchange) throw new NotFoundException('Exchange not found');
    if (exchange.method !== ExchangeMethod.COURIER_DELIVERY) {
      throw new NotFoundException(
        'Labels are only generated for courier deliveries',
      );
    }

    const verification = exchange.verifications[0];
    if (!verification) {
      throw new NotFoundException(
        'No active verification code found. Please dispatch the exchange first.',
      );
    }

    const code = verification.code;
    const confirmBaseUrl = `${this.appConfig.frontEndUrl}/delivery/confirm`;
    const confirmUrl = `${confirmBaseUrl}?code=${code}`;
    const deepLink = `citizenlinkapp://confirm-delivery?code=${code}`;

    const qrDataUri = await QRCode.toDataURL(confirmUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200,
    });

    const addressSnap = exchange.addressSnapshot as Record<
      string,
      string
    > | null;
    const stationSnap = exchange.stationSnapshot as Record<
      string,
      string
    > | null;

    const docTypeName =
      exchange.foundCase.case.document?.type?.name ?? 'Document';
    const recipientName =
      addressSnap?.name ?? exchange.claim?.user?.name ?? 'Recipient';

    const addressLines = [
      addressSnap?.address1,
      addressSnap?.address2,
      addressSnap?.level3,
      addressSnap?.level2,
      addressSnap?.level1,
    ]
      .filter(Boolean)
      .join(', ');

    const stationName = stationSnap?.name ?? 'CitizenLink Station';
    const stationAddress = stationSnap
      ? [stationSnap.address1, stationSnap.level2, stationSnap.level1]
          .filter(Boolean)
          .join(', ')
      : '';

    const html = await this.templates.renderFile('print', 'delivery-label', {
      exchangeNumber: dto.exchangeNumber,
      recipientName,
      addressLines,
      landmark: addressSnap?.landmark ? `Near: ${addressSnap.landmark}` : '',
      recipientPhone: addressSnap?.phoneNumber
        ? `Tel: ${addressSnap.phoneNumber}`
        : '',
      docTypeName,
      stationName,
      stationAddress,
      qrDataUri,
      code,
      confirmBaseUrl,
      deepLink,
      expiresAt: verification.expiresAt.toLocaleString(),
    });

    return this.pdfService.generatePdf(html, {
      width: '148mm',
      height: '105mm',
      landscape: false,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  }
}

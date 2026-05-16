import { Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { AppConfig } from '../app.config';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExchangeMethod,
  VerificationStatus,
} from '../../generated/prisma/client';

@Injectable()
export class DocumentExchangeLabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfig,
  ) {}

  async getLabel(exchangeNumber: string): Promise<string> {
    const exchange = await this.prisma.documentExchange.findUnique({
      where: { exchangeNumber },
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
    const confirmUrl = `${this.appConfig.frontEndUrl}/delivery/confirm?code=${code}`;
    const deepLink = `citizenlinkapp://confirm-delivery?code=${code}`;

    // QR encodes the web URL; the deep link is a fallback shown as text on the label
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

    const landmark = addressSnap?.landmark
      ? `Near: ${addressSnap.landmark}`
      : '';
    const recipientPhone = addressSnap?.phoneNumber
      ? `Tel: ${addressSnap.phoneNumber}`
      : '';

    const stationName = stationSnap?.name ?? 'CitizenLink Station';
    const stationAddress = stationSnap
      ? [stationSnap.address1, stationSnap.level2, stationSnap.level1]
          .filter(Boolean)
          .join(', ')
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Delivery Label — ${exchangeNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', sans-serif;
      background: #fff;
      color: #1a1a1a;
    }
    .label {
      width: 148mm;
      min-height: 105mm;
      border: 2px solid #003b5a;
      border-radius: 4px;
      padding: 10mm;
      display: flex;
      flex-direction: column;
      gap: 5mm;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1.5px solid #003b5a;
      padding-bottom: 4mm;
    }
    .brand { font-size: 15pt; font-weight: 700; color: #003b5a; }
    .badge {
      font-size: 7pt;
      font-weight: 600;
      background: #006397;
      color: #fff;
      padding: 2px 8px;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }
    .body { display: flex; gap: 6mm; }
    .left { flex: 1; display: flex; flex-direction: column; gap: 3mm; }
    .right { display: flex; flex-direction: column; align-items: center; gap: 2mm; }
    .section-label {
      font-size: 6pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 1mm;
    }
    .recipient-name { font-size: 11pt; font-weight: 700; color: #003b5a; }
    .address { font-size: 8pt; color: #334155; line-height: 1.5; }
    .doc-type {
      font-size: 8pt;
      font-weight: 600;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      color: #0369a1;
      padding: 2px 6px;
      border-radius: 3px;
      display: inline-block;
    }
    .exchange-number { font-size: 7pt; color: #64748b; }
    .qr img { width: 52mm; height: 52mm; }
    .code-block {
      text-align: center;
      background: #f8fafc;
      border: 1.5px solid #003b5a;
      border-radius: 4px;
      padding: 2mm 4mm;
      width: 52mm;
    }
    .code-label { font-size: 6pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; }
    .code { font-size: 18pt; font-weight: 700; color: #003b5a; letter-spacing: 6px; font-family: 'Courier New', monospace; }
    .instructions {
      font-size: 7pt;
      color: #475569;
      background: #fffbeb;
      border-left: 3px solid #e8b84b;
      padding: 2mm 3mm;
      line-height: 1.5;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 3mm;
      font-size: 6.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      html, body { width: 148mm; height: auto; }
      .label { border: 2px solid #003b5a !important; page-break-inside: avoid; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <div style="padding: 5mm; display: flex; flex-direction: column; gap: 3mm;">
    <button onclick="window.print()"
      style="padding: 8px 20px; background: #003b5a; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; align-self: flex-start;">
      Print Label
    </button>

    <div class="label">
      <div class="header">
        <span class="brand">Citizen Link</span>
        <span class="badge">COURIER DELIVERY</span>
      </div>

      <div class="body">
        <div class="left">
          <div>
            <div class="section-label">Deliver to</div>
            <div class="recipient-name">${recipientName}</div>
            <div class="address">${addressLines}</div>
            ${landmark ? `<div class="address" style="margin-top:1mm;">${landmark}</div>` : ''}
            ${recipientPhone ? `<div class="address" style="margin-top:1mm;">${recipientPhone}</div>` : ''}
          </div>

          <div>
            <div class="section-label">Document type</div>
            <span class="doc-type">${docTypeName}</span>
          </div>

          <div>
            <div class="section-label">Dispatched from</div>
            <div class="address" style="font-weight:600;">${stationName}</div>
            ${stationAddress ? `<div class="address">${stationAddress}</div>` : ''}
          </div>

          <div class="exchange-number">Exchange: ${exchangeNumber}</div>
        </div>

        <div class="right">
          <div class="qr">
            <img src="${qrDataUri}" alt="Scan to confirm delivery" />
          </div>
          <div class="code-block">
            <div class="code-label">Confirmation Code</div>
            <div class="code">${code}</div>
          </div>
        </div>
      </div>

      <div class="instructions">
        <strong>For the recipient:</strong> Scan the QR code or visit
        <strong>${this.appConfig.frontEndUrl}/delivery/confirm</strong> and enter the code above to confirm receipt.
        You can also enter the code in the Citizen Link mobile app.
      </div>

      <div class="footer">
        <span>Deep link: ${deepLink}</span>
        <span>Expires: ${verification.expiresAt.toLocaleString()}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}

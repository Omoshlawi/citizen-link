import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { z } from 'zod';
import { MauzoConfig } from './mauzo.config';
import { WebHookSchema } from './mauzo.dto';
import {
  MAUZOPLUS_SIGNATURE_HEADER,
  WEBHOOK_MAX_AGE_MS,
} from './mauzo.constants';

type MauzoWebhookPayload = z.infer<typeof WebHookSchema>;

export function readMauzoPlusSignatureHeader(
  headers: IncomingHttpHeaders,
): string | undefined {
  const want = MAUZOPLUS_SIGNATURE_HEADER.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === want) {
      if (value === undefined) return undefined;
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}

@Injectable()
export class MauzoWebHookService {
  constructor(private readonly config: MauzoConfig) {}

  /**
   * Reads {@link MAUZOPLUS_SIGNATURE_HEADER}, verifies `t` and `v1` per MauzoPlus docs
   * (HMAC-SHA256 of `${t}.${rawBody}` with the webhook secret, reject if older than 5 minutes),
   * then parses and validates JSON with {@link WebHookSchema}.
   */
  verifyAndParseFromHeaders(
    rawBody: string | Buffer,
    headers: IncomingHttpHeaders,
  ): MauzoWebhookPayload {
    return this.verifyAndParse(rawBody, readMauzoPlusSignatureHeader(headers));
  }

  /**
   * Same as {@link verifyAndParseFromHeaders} but accepts the raw
   * `MauzoPlus-Signature` header value (e.g. if you already read it from the request).
   */
  verifyAndParse(
    rawBody: string | Buffer,
    mauzoPlusSignatureHeader: string | undefined,
  ): MauzoWebhookPayload {
    this.assertValidSignature(rawBody, mauzoPlusSignatureHeader);
    const text =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new UnauthorizedException('Invalid webhook JSON');
    }
    const parsed = WebHookSchema.safeParse(json);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid webhook payload');
    }
    return parsed.data;
  }

  private assertValidSignature(
    rawBody: string | Buffer,
    header: string | undefined,
  ): void {
    if (!header?.trim()) {
      throw new UnauthorizedException('Missing MauzoPlus-Signature header');
    }
    const { t, v1 } = parseMauzoPlusSignatureHeader(header);
    if (t === undefined || v1 === undefined || Number.isNaN(t)) {
      throw new UnauthorizedException('Malformed MauzoPlus-Signature header');
    }
    if (Date.now() - t * 1000 > WEBHOOK_MAX_AGE_MS) {
      throw new UnauthorizedException('Webhook timestamp too old');
    }
    const payload =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = createHmac('sha256', this.config.webHookSecreteKey)
      .update(`${t}.${payload}`)
      .digest('hex');
    const sigBuf = Buffer.from(v1, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expectedBuf.length) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    if (!timingSafeEqual(sigBuf, expectedBuf)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}

type MauzoPlusSigParts = {
  t?: number;
  v1?: string;
};

/** Parses `t=1713456789,v1=5257a869559...` as in MauzoPlus webhook docs. */
function parseMauzoPlusSignatureHeader(header: string): MauzoPlusSigParts {
  const out: MauzoPlusSigParts = {};
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      out.t = parseInt(value, 10);
    } else if (key === 'v1') {
      out.v1 = value;
    }
  }
  return out;
}

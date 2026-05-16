import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MauzoConfig } from './mauzo.config';
import type { Request } from 'express';

type RawBodyRequest = Request & { rawBody?: Buffer | string };
import {
  MAUZOPLUS_SIGNATURE_HEADER,
  WEBHOOK_MAX_AGE_MS,
} from './mauzo.constants';

@Injectable()
export class MauzoWebhookSignatureGuard implements CanActivate {
  constructor(private readonly config: MauzoConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest>();
    const secret = this.config.webHookSecreteKey;

    if (!secret)
      throw new UnauthorizedException('Webhook secret not configured');

    const rawHeader =
      req.headers[MAUZOPLUS_SIGNATURE_HEADER.toLowerCase()] ?? '';
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!header?.trim())
      throw new UnauthorizedException('Missing signature header');

    const parts: Record<string, string> = {};
    for (const part of String(header).split(',')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      parts[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }

    const ts = parseInt(parts['t'], 10);
    const sig = parts['v1'];

    if (!ts || Number.isNaN(ts) || !sig)
      throw new UnauthorizedException('Malformed signature header');

    if (Date.now() - ts * 1000 > WEBHOOK_MAX_AGE_MS)
      throw new UnauthorizedException('Webhook timestamp too old');

    const payload: string =
      req.rawBody instanceof Buffer
        ? req.rawBody.toString('utf8')
        : typeof req.rawBody === 'string'
          ? req.rawBody
          : req.body
            ? JSON.stringify(req.body)
            : '';

    const expected = createHmac('sha256', secret)
      .update(`${ts}.${payload}`)
      .digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (
      sigBuf.length === expectedBuf.length &&
      timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return true;
    }

    throw new UnauthorizedException('Invalid webhook signature');
  }
}

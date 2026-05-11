/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class MauzoConfig {
  @Value('MAUZO_BASE_URL', {
    parse: z.url({ message: 'Invalid MAUZO_BASE_URL' }).parse,
  })
  baseUrl!: string;
  @Value('MAUZO_PUBLIC_KEY', {
    parse: z.string({ message: 'Invalid MAUZO_PUBLIC_KEY' }).parse,
  })
  publicKey!: string;
  @Value('MAUZO_SECTRETE_KEY', {
    parse: z.string({ message: 'Invalid MAUZO_SECTRETE_KEY' }).parse,
  })
  secreteKey!: string;
  @Value('MAUZO_WEBHOOK_SECRETE', {
    parse: z.string({ message: 'Invalid MAUZO_WEBHOOK_SECRETE' }).parse,
  })
  webHookSecreteKey!: string;
}

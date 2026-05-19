/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class ChatBotConfig {
  @Value('AI_SERVICE_URL', {
    parse: z.url({ message: 'Invalid AI_SERVICE_URL' }).parse,
  })
  baseUrl!: string;

  @Value('AI_SERVICE_INTERNAL_SECRET', {
    parse: z
      .string()
      .min(16, 'AI_SERVICE_INTERNAL_SECRET must be at least 16 chars').parse,
  })
  internalSecrete!: string;
}

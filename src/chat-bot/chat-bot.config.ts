/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class ChatBotConfig {
  @Value('CHATBOT_SERVICE_URL', {
    parse: z.url({ message: 'Invalid CHATBOT_SERVICE_URL' }).parse,
  })
  baseUrl!: string;

  @Value('CHATBOT_SERVICE_INTERNAL_SECRET', {
    parse: z
      .string()
      .min(16, 'CHATBOT_SERVICE_INTERNAL_SECRET must be at least 16 chars')
      .parse,
  })
  internalSecrete!: string;
}

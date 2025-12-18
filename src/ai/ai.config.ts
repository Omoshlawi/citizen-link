/* eslint-disable @typescript-eslint/unbound-method */
import z from 'zod';
import { Configuration, Value } from '@itgorillaz/configify';
import { ChatModel } from 'openai/resources/chat/chat';

@Configuration()
export class AiConfig {
  @Value('OPENAI_API_KEY', { parse: z.string().nonempty().parse })
  openaiApiKey: string;

  @Value('AI_BASE_URL', { parse: z.string().url().optional().parse })
  aiBaseUrl?: string;

  @Value('AI_MODEL', {
    parse: z.string().optional().parse,
    default: 'deepseek-chat',
  })
  aiModel?: ChatModel;
}

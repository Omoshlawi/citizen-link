/* eslint-disable @typescript-eslint/unbound-method */
import z from 'zod';
import { Configuration, Value } from '@itgorillaz/configify';
import { ChatModel } from 'openai/resources/chat/chat';

@Configuration()
export class AiConfig {
  @Value('OPENAI_API_KEY', {
    parse: z.string({ message: 'OpenAI API Key is required' }).nonempty().parse,
  })
  openaiApiKey: string;

  @Value('OPENAI_BASE_URL', {
    parse: z.url({ message: 'OpenAI Base URL is required' }).optional().parse,
  })
  aiBaseUrl: string;

  @Value('OPENAI_MODEL', {
    parse: z.string({ message: 'OpenAI Model is required' }).optional().parse,
    default: 'deepseek-chat',
  })
  aiModel: ChatModel;
}

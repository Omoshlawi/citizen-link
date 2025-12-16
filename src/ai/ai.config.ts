/* eslint-disable @typescript-eslint/unbound-method */
import z from 'zod';
import { Configuration, Value } from '@itgorillaz/configify';

@Configuration()
export class AiConfig {
  @Value('GEMINI_API_KEY', { parse: z.string().nonempty().parse })
  geminiApiKey: string;

  @Value('DEEPSEEK_API_KEY', { parse: z.string().nonempty().parse })
  deepSeekApiKey: string;
}

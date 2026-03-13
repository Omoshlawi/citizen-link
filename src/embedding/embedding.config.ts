/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class EmbeddingConfig {
  @Value('EMBEDDING_MODEL', {
    parse: z.string().optional().parse,
    default: 'nomic-embed-text',
  })
  model: string;
  @Value('EMBEDDING_IS_OPENAI', {
    parse: z
      .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
      .optional().parse,
    default: 'false',
  })
  isOpenAi: boolean;

  @Value('EMBEDDING_BASE_URL', {
    parse: z.url().optional().parse,
    default: 'http://localhost:11434',
  })
  baseUrl: string;
  @Value('EMBEDDING_API_KEY', {
    parse: z.string().optional().parse,
    default: 'ollama',
  })
  apiKey: string;
}

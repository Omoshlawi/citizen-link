/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class EmbeddingConfig {
  @Value('EMBEDDING_MODEL', {
    parse: z.string().optional().parse,
    default: 'nomic-embed-text',
  })
  embeddingModel: string;

  @Value('EMBEDDING_BASE_URL', {
    parse: z.url().optional().parse,
    default: 'http://localhost:11434',
  })
  embeddingBaseUrl: string;
}

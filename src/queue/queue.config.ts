/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class QueueConfig {
  @Value('REDIS_DB_URL', {
    parse: z.url({ message: 'Invalid Redis URL' }).optional().parse,
    default: 'redis://localhost:6379',
  })
  redisDbUrl: string;
}

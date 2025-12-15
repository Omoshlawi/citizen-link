/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class PrismaConfig {
  @Value('DATABASE_URL', { parse: z.url().parse })
  databaseUrl: string;
}

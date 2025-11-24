/* eslint-disable @typescript-eslint/unbound-method */
import z from 'zod';
import { Configuration, Value } from '@itgorillaz/configify';

@Configuration()
export class AiConfig {
  @Value('GOOGLE_API_KEY', { parse: z.string().nonempty().parse })
  googleApiKey: string;
}

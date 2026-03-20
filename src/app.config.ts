import { Configuration, Value } from '@itgorillaz/configify';

@Configuration()
export class AppConfig {
  @Value('PORT', { parse: parseInt, default: 2000 })
  port: number;
  @Value('BETTER_AUTH_URL', { default: 'http://localhost:2000' })
  betterAuthUrl: string;
}

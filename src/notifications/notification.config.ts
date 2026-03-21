import { Configuration, Value } from '@itgorillaz/configify';

@Configuration()
export class NotificationConfig {
  @Value('EXPO_ACCESS_TOKEN')
  expoAccessToken?: string;

  @Value('SMTP_HOST', { default: 'localhost' })
  smtpHost?: string;

  @Value('SMTP_PORT', { default: 1025 })
  smtpPort?: number;

  @Value('SMTP_USER')
  smtpUser?: string;

  @Value('SMTP_PASSWORD')
  smtpPassword?: string;

  @Value('SMTP_FROM', { default: '"No Reply" <noreply@example.com>' })
  smtpFrom?: string;

  @Value('SMTP_NAME', { default: 'No Reply' })
  smtpName?: string;
}

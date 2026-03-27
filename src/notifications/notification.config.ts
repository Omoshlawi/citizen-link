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

  // No default — a missing SMTP_FROM triggers a startup warning in EmailChannelModule.
  // Set this to your actual sender address in production.
  @Value('SMTP_FROM')
  smtpFrom?: string;

  @Value('SMTP_NAME', { default: 'No Reply' })
  smtpName?: string;

  @Value('TWILIO_ACCOUNT_SID')
  twilioAccountSid?: string;

  @Value('TWILIO_AUTH_TOKEN')
  twilioAuthToken?: string;

  @Value('TWILIO_FROM_NUMBER')
  twilioFromNumber?: string;

  @Value('AFRICASTALKING_API_KEY')
  africastalkingApiKey?: string;

  @Value('AFRICASTALKING_USERNAME')
  africastalkingUsername?: string;

  @Value('AFRICASTALKING_SENDER_ID')
  africastalkingSenderId?: string;
}

import { Configuration, Value } from '@itgorillaz/configify';

@Configuration()
export class NotificationConfig {
  @Value('WELCOME_SMS_TEMPLATE', {
    default:
      'Dear {{name}}, welcome to our service! Your registration was successful. We are excited to have you as a valued customer. If you have any questions or need assistance, please contact our support team at {{support_phone}}',
  })
  welcomeSmsTemplate: string;
  @Value('SUPPORT_PHONE', {
    default: '+250788123456',
  })
  supportPhone: string;
}

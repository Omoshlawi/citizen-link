import { Configuration, Value } from '@itgorillaz/configify';

@Configuration()
export class NotificationConfig {
  @Value('EXPO_ACCESS_TOKEN')
  expoAccessToken?: string;
}

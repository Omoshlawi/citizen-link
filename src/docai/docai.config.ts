import { Configuration, Value } from '@itgorillaz/configify';

@Configuration()
export class DocaiConfig {
  /** Base URL for the citizen-link-docai service (e.g. http://localhost:8002) */
  @Value('DOCAI_SERVICE_URL')
  serviceUrl!: string;

  /** Secret docai sends in X-Internal-Secret on every outgoing webhook — validate on receipt */
  @Value('DOCAI_CALLBACK_SECRET')
  callbackSecret!: string;

  /** Secret NestJS sends in X-Internal-Secret when calling docai — must match docai's INTERNAL_SECRET */
  @Value('DOCAI_SERVICE_INTERNAL_SECRET')
  serviceInternalSecret!: string;

  /**
   * Full URL docai will POST stage webhooks to.
   * Must be reachable from the docai container — use host.docker.internal in Docker.
   * e.g. http://host.docker.internal:2000/api/webhooks/docai/progress
   */
  @Value('DOCAI_WEBHOOK_URL')
  webhookUrl!: string;
}

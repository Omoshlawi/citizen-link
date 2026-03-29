import { Injectable, Logger } from '@nestjs/common';
import {
  EmailPayload,
  IEmailProvider,
  ProviderResult,
} from '../../notification.interfaces';

@Injectable()
export class EmailChannelService {
  private readonly logger = new Logger(EmailChannelService.name);

  constructor(private readonly providers: IEmailProvider[]) {}

  async send(payload: EmailPayload): Promise<ProviderResult> {
    if (!this.providers?.length) {
      return { success: false, error: 'No email providers configured' };
    }
    const errors: string[] = [];
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      this.logger.log(
        `[${i + 1}/${this.providers.length}] Trying ${provider.name} for ${payload.to}`,
      );
      const result = await provider.send(payload);
      if (result.success) return { ...result, providerName: provider.name };
      this.logger.warn(
        `[${i + 1}/${this.providers.length}] ${provider.name} failed: ${result.error}`,
      );
      errors.push(
        `[${provider.name}] ${result.errorCode ?? ''} - ${result.error ?? ''}`,
      );
    }
    return {
      success: false,
      error: 'Exhausted all email providers: ' + errors.join(', '),
    };
  }
}

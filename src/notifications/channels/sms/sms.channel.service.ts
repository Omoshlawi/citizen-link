import { Injectable, Logger } from '@nestjs/common';
import {
  ISmsProvider,
  ProviderResult,
  SmsPayload,
} from '../../notification.interfaces';

@Injectable()
export class SmsChannelService {
  private readonly logger = new Logger(SmsChannelService.name);

  constructor(private readonly providers: ISmsProvider[]) {}

  async send(payload: SmsPayload): Promise<ProviderResult> {
    if (!this.providers?.length) {
      return { success: false, error: 'No SMS providers configured' };
    }
    const errors: string[] = [];
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      this.logger.log(`[${i + 1}/${this.providers.length}] Trying ${provider.name} for ${payload.to}`);
      const result = await provider.send(payload);
      if (result.success) return { ...result, providerName: provider.name };
      this.logger.warn(`[${i + 1}/${this.providers.length}] ${provider.name} failed: ${result.error}`);
      errors.push(`[${provider.name}] ${result.errorCode ?? ''} - ${result.error ?? ''}`);
    }
    return {
      success: false,
      error: 'Exhausted all SMS providers: ' + errors.join(', '),
    };
  }
}

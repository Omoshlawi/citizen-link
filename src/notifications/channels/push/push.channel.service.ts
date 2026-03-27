import { Injectable, Logger } from '@nestjs/common';
import {
  IPushProvider,
  ProviderResult,
  PushPayload,
} from '../../notification.interfaces';

@Injectable()
export class PushChannelService {
  private readonly logger = new Logger(PushChannelService.name);

  constructor(private readonly providers: IPushProvider[]) {}

  async send(payload: PushPayload): Promise<ProviderResult> {
    if (!this.providers?.length) {
      return { success: false, error: 'No push providers configured' };
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
      error: 'Exhausted all push providers: ' + errors.join(', '),
    };
  }
}

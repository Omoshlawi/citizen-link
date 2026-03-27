import { DynamicModule, Module, Type } from '@nestjs/common';
import { PushChannelService } from './push.channel.service';
import { ExpoPushProvider } from './providers/expo.provider';
import { IPushProvider, PushProviders } from '../../notification.interfaces';

@Module({})
export class PushChannelModule {
  static register(options: { providers: PushProviders[] }): DynamicModule {
    const pushProviderMap: Record<PushProviders, Type<IPushProvider>> = {
      [PushProviders.EXPO]: ExpoPushProvider,
    };

    const providerClasses = options.providers
      .map((p) => pushProviderMap[p])
      .filter(Boolean);

    return {
      module: PushChannelModule,
      providers: [
        ...providerClasses,
        {
          provide: PushChannelService,
          useFactory: (...providers: IPushProvider[]) =>
            new PushChannelService(providers),
          inject: providerClasses,
        },
      ],
      exports: [PushChannelService],
    };
  }
}

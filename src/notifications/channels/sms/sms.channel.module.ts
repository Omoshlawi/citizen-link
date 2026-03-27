import { DynamicModule, Module, Type } from '@nestjs/common';
import { SmsChannelService } from './sms.channel.service';
import { TwilioProvider } from './providers/twilio.provider';
import { AfricasTalkingProvider } from './providers/africastalking.provider';
import { ISmsProvider, SmsProviders } from '../../notification.interfaces';

@Module({})
export class SmsChannelModule {
  static register(options: { providers: SmsProviders[] }): DynamicModule {
    const smsProviderMap: Record<SmsProviders, Type<ISmsProvider>> = {
      [SmsProviders.TWILIO]: TwilioProvider,
      [SmsProviders.AFRICASTALK]: AfricasTalkingProvider,
    };

    const providerClasses = options.providers
      .map((p) => smsProviderMap[p])
      .filter(Boolean);

    return {
      module: SmsChannelModule,
      providers: [
        ...providerClasses,
        {
          provide: SmsChannelService,
          useFactory: (...providers: ISmsProvider[]) =>
            new SmsChannelService(providers),
          inject: providerClasses,
        },
      ],
      exports: [SmsChannelService],
    };
  }
}

import { DynamicModule, Logger, Module, Type } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { NotificationConfig } from '../../notification.config';
import { EmailChannelService } from './email.channel.service';
import { EmailMailpitProvider } from './providers/mailpit.provider';
import { EmailProviders, IEmailProvider } from '../../notification.interfaces';

@Module({})
export class EmailChannelModule {
  static register(options: { providers: EmailProviders[] }): DynamicModule {
    const emailProviderMap: Record<EmailProviders, Type<IEmailProvider>> = {
      [EmailProviders.MAILPIT]: EmailMailpitProvider,
    };

    const providerClasses = options.providers
      .map((p) => emailProviderMap[p])
      .filter(Boolean);

    return {
      module: EmailChannelModule,
      imports: [
        MailerModule.forRootAsync({
          inject: [NotificationConfig],
          useFactory: (config: NotificationConfig) => {
            const smtpFrom =
              config.smtpFrom ?? 'CitizenLink <no-reply@localhost>';
            if (!config.smtpFrom) {
              new Logger('EmailChannelModule').warn(
                'SMTP_FROM is not configured — defaulting to "CitizenLink <no-reply@localhost>". ' +
                  'Set SMTP_FROM in your environment for production.',
              );
            }
            return {
              transport: {
                host: config.smtpHost,
                port: config.smtpPort,
                // auth: {
                //   user: config.smtpUser,
                //   pass: config.smtpPassword,
                // },
              },
              defaults: {
                from: smtpFrom,
                name: config.smtpName,
              },
              template: {
                adapter: new HandlebarsAdapter(),
              },
            };
          },
        }),
      ],
      providers: [
        ...providerClasses,
        {
          provide: EmailChannelService,
          useFactory: (...providers: IEmailProvider[]) =>
            new EmailChannelService(providers),
          inject: providerClasses,
        },
      ],
      exports: [EmailChannelService],
    };
  }
}

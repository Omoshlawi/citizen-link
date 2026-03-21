/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import {
  EmailPayload,
  IEmailProvider,
  ProviderResult,
} from '../notification.interfaces';
import { SentMessageInfo } from 'nodemailer';

@Injectable()
export class EmailMailpitProvider implements IEmailProvider {
  readonly name = 'mailpit';

  private readonly logger = new Logger(EmailMailpitProvider.name);

  constructor(private readonly mailer: MailerService) {}

  async send(payload: EmailPayload): Promise<ProviderResult> {
    try {
      const result: SentMessageInfo = await this.mailer.sendMail({
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
        attachments:
          payload.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })) ?? [],
      });
      this.logger.log(`Mailpit send success to ${payload.to}: ${result}`);
      return {
        success: true,
        messageId: result.messageId as string,
      };
    } catch (err: any) {
      this.logger.error(
        `Mailpit send failed to ${payload.to}: ${(err as Error).message}`,
      );
      return {
        success: false,
        error: (err as Error).message,
        raw: { isPermanent: false },
      };
    }
  }
}

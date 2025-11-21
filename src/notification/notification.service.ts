import { Injectable, Logger } from '@nestjs/common';
import { Customer, NotificationStatus } from '../../generated/prisma/browser';
import { NotificationConfig } from '../config/notification.config';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationService {
  private readonly logger: Logger = new Logger(NotificationService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationConfig: NotificationConfig,
  ) {}

  async sendWelcomeSms(to: string, customer: Customer) {
    this.logger.debug("Template String", this.notificationConfig.welcomeSmsTemplate);
    const message = this.parseMessage(
      {
        name: customer.name,
        support_phone: this.notificationConfig.supportPhone,
      },
      this.notificationConfig.welcomeSmsTemplate,
    );
    this.logger.debug(`Sending SMS to ${to} with message ${message}`);
    const sms = await this.prismaService.sMSNotification.create({
      data: {
        to,
        message,
        status: NotificationStatus.PENDING,
        customerId: customer.id,
      },
    });
    this.logger.debug(`SMS created with id ${sms.id}`);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async retryFailedSms() {
    this.logger.debug('Retrying failed SMS');
    const failedSms = await this.prismaService.sMSNotification.findMany({
      where: { status: NotificationStatus.FAILED },
      include: {
        customer: true,
      },
    });
    this.logger.debug(`Found ${failedSms.length} failed SMS`);
    for (const sms of failedSms) {
      this.logger.debug(
        `Retrying SMS ${sms.id} for customer ${sms.customer!.id}`,
      );
      await this.sendWelcomeSms(sms.to, sms.customer!);
      this.logger.debug(`SMS ${sms.id} retried successfully`);
    }
  }

  private parseMessage(object: Record<string, any>, template: string): string {
    // regular expression to match placeholders like {{field}}
    const placeholderRegex = /{{(.*?)}}/g;

    // Use a replace function to replace placeholders with corresponding values
    const parsedMessage = template.replace(
      placeholderRegex,
      (match: string, fieldName: string) => {
        // The fieldName variable contains the field name inside the placeholder
        // Check if the field exists in the event object
        if (Object.prototype.hasOwnProperty.call(object, fieldName)) {
          return String(object[fieldName]); // Replace with the field's value
        } else {
          // Placeholder not found in event, leave it unchanged
          return match;
        }
      },
    );

    return parsedMessage;
  }
}

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Expo,
  ExpoClientOptions,
  ExpoPushMessage,
  ExpoPushTicket,
} from 'expo-server-sdk';
import { EXPO_NOTIFICATIONS_OPTIONS_TOKEN } from './expo-sdk.constants';

@Injectable()
export class ExpoSdkService implements OnModuleInit {
  private readonly logger = new Logger(ExpoSdkService.name);
  private expo: Expo;

  constructor(
    @Inject(EXPO_NOTIFICATIONS_OPTIONS_TOKEN)
    private readonly options: ExpoClientOptions,
  ) {}
  onModuleInit() {
    this.expo = new Expo(this.options);
  }

  get api() {
    return this.expo;
  }

  /**
   * Send a single push notification
   */
  async sendPushNotification<TData extends Record<string, unknown>>(
    pushToken: string,
    data: TData,
    transformer: (data: TData, token: string) => ExpoPushMessage,
  ): Promise<ExpoPushTicket> {
    if (!this.isValidPushToken(pushToken)) {
      this.logger.warn(`Invalid push token: ${pushToken}`);
      throw new Error(`Invalid push token: ${pushToken}`);
    }
    const message = transformer(data, pushToken);
    try {
      const ticket = await this.expo.sendPushNotificationsAsync([message]);
      this.logger.log(`Push notification sent to ${pushToken}`);
      return ticket[0];
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error}`);
      throw error;
    }
  }

  /**
   * Send multiple push notifications at once
   */
  async sendPushNotifications<TData extends Record<string, unknown>>(
    pushTokens: string[],
    data: TData,
    transformer: (data: TData, token: string) => ExpoPushMessage,
  ): Promise<ExpoPushTicket[]> {
    // Create the messages that you want to send to clients
    const messages = pushTokens.map<ExpoPushMessage>((pushToken) => {
      if (!this.isValidPushToken(pushToken)) {
        throw new Error(
          `Push token ${pushToken} is not a valid Expo push token`,
        );
      }
      return transformer(data, pushToken);
    });

    if (messages.length === 0) {
      this.logger.warn('No valid push tokens to send notifications to');
      return [];
    }

    // The Expo push notification service accepts batches of notifications so
    // that you don't need to send 1000 requests to send 1000 notifications. We
    // recommend you batch your notifications to reduce the number of requests
    // and to compress them (notifications with similar content will get
    // compressed).
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    // Send the chunks to the Expo push notification service. There are
    // different strategies you could use. A simple one is to send one chunk at a
    // time, which nicely spreads the load out over time:
    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        this.logger.log(
          'Successfully sent push notification chunk',
          ticketChunk,
        );
        tickets.push(...ticketChunk);
        // NOTE: If a ticket contains an error code in ticket.details.error, you
        // must handle it appropriately. The error codes are listed in the Expo
        // documentation:
        // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
      } catch (error) {
        this.logger.error('Failed to send push notification chunk', error);
      }
    }
    return tickets;
  }

  /**
   * Get push notification receipts
   */
  async getPushNotificationReceipts(
    ticketIds: string[],
  ): Promise<Record<string, unknown>> {
    try {
      const receipts =
        await this.expo.getPushNotificationReceiptsAsync(ticketIds);
      this.logger.log(
        `Retrieved ${Object.keys(receipts).length} push notification receipts`,
      );
      return receipts;
    } catch (error) {
      this.logger.error(`Failed to get push notification receipts: ${error}`);
      throw error;
    }
  }

  /**
   * Check if a push token is valid
   */
  isValidPushToken(pushToken: string): boolean {
    return Expo.isExpoPushToken(pushToken);
  }
}

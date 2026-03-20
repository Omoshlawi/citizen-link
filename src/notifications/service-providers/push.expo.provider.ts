import { Injectable, Logger } from '@nestjs/common';
import {
  Expo,
  ExpoPushMessage,
  ExpoPushReceiptId,
  ExpoPushTicket,
} from 'expo-server-sdk';
import { NotificationConfig } from '../notification.config';
import {
  IPushProvider,
  ProviderResult,
  PushPayload,
} from '../notification.interfaces';

/**
 *  Expo delivery model
 * Expo push delivery is two-phase:
 *
 *   Phase 1 — send()
 *   You POST messages to Expo's servers.
 *   Expo returns a TICKET per message:
 *     - success ticket → { status: 'ok', id: 'receipt-id' }
 *     - error ticket   → { status: 'error', details: { error: 'DeviceNotRegistered' } }
 *
 *   Phase 2 — checkReceipts() (optional, run separately)
 *   Expo forwards messages to APNs/FCM. You later fetch receipts by ticket ID
 *   to confirm actual delivery to the device. Receipts are available ~15 min later.
 *
 * For most notification use cases Phase 1 is sufficient.
 * Run Phase 2 (checkReceipts) as a scheduled job if you need delivery confirmation.
 */

// Expo error types that mean the token is permanently invalid — deactivate it
const INVALID_TOKEN_ERRORS = new Set([
  'DeviceNotRegistered', // user uninstalled the app or token expired
  'InvalidCredentials', // your Expo credentials are wrong — check config
]);

@Injectable()
export class ExpoPushProvider implements IPushProvider {
  //   IPushProvider contract
  //   readonly name: string
  //   send(payload: PushPayload): Promise<ProviderResult>
  //   sendBatch?(payloads: PushPayload[]): Promise<ProviderResult[]>   ← optional

  readonly name = 'expo';

  private readonly logger = new Logger(ExpoPushProvider.name);
  private readonly expo: Expo;

  constructor(private readonly config: NotificationConfig) {
    this.expo = new Expo({
      accessToken: this.config.expoAccessToken,
    });
  }

  // Single send — delegates to sendBatch() for consistency.
  // The processor calls this for one token at a time.
  async send(payload: PushPayload): Promise<ProviderResult> {
    const [result] = await this.sendBatch([payload]);
    return result;
  }

  private isValidExpoToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  // Expo recommends batching — you can send up to 100 messages per HTTP request.
  // The PushDispatcher calls this when a user has multiple devices.
  async sendBatch(payloads: PushPayload[]): Promise<ProviderResult[]> {
    // Step 1: Separate valid Expo tokens from invalid ones
    // Expo.isExpoPushToken() checks the token format — starts with 'ExponentPushToken['
    // An invalid token never reaches Expo's servers — fail fast locally.
    const valid: PushPayload[] = [];
    const invalid: PushPayload[] = [];

    for (const p of payloads) {
      if (this.isValidExpoToken(p.to)) {
        valid.push(p);
      } else {
        invalid.push(p);
        this.logger.warn(`Invalid Expo token format: ${p.to}`);
      }
    }

    // Results array — will be filled in the same order as input payloads
    const invalidResults: ProviderResult[] = invalid.map(() => ({
      success: false,
      error: 'InvalidToken',
      errorCode: 'INVALID_TOKEN_FORMAT',
      raw: { isPermanent: true },
    }));

    if (!valid.length) return invalidResults;

    // ── Step 2: Build Expo message objects ────────────────────────────────
    const messages: ExpoPushMessage[] = valid.map((p) => ({
      to: p.to,
      title: p.title,
      body: p.body,
      data: p.data ?? {},
      badge: p.badge,
      sound: p.sound ?? 'default',
      channelId: p.channelId, // Android notification channel ID
      priority: 'high', // 'default' | 'normal' | 'high'
      // 'high' wakes the device even in Doze mode (Android) / background (iOS)
    }));

    try {
      // ── Step 3: Chunk and send ───────────────────────────────────────────
      // Expo limits 100 messages per request — chunkPushNotifications splits
      // your array automatically so you never exceed the limit.
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
      }

      // ── Step 4: Map tickets to ProviderResult ────────────────────────────
      // One ticket per message, in the same order as messages[]
      const validResults: ProviderResult[] = tickets.map((ticket) => {
        if (ticket.status === 'ok') {
          // Phase 1 success — Expo accepted the message and will forward to APNs/FCM
          // ticket.id is the receipt ID for Phase 2 (delivery confirmation)
          return {
            success: true,
            messageId: ticket.id,
          };
        }

        // Phase 1 error — Expo rejected the message before forwarding
        const errTicket = ticket;
        const errorCode = errTicket.details?.error ?? 'UnknownError';
        const isPermanent = INVALID_TOKEN_ERRORS.has(errorCode);

        this.logger.warn(
          `Expo ticket error [${errorCode}]: ${errTicket.message}`,
        );

        return {
          success: false,
          error: errTicket.message,
          errorCode,
          raw: {
            isPermanent,
            // The processor checks isPermanent to decide whether to deactivate the token
            details: errTicket.details,
          },
        };
      });

      // Return results in original input order: valid results first, then invalid
      return [...validResults, ...invalidResults];
    } catch (err: unknown) {
      // Network error, Expo outage, etc. — all valid tokens fail together
      this.logger.error(
        `Expo batch send failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return [
        ...valid.map(() => ({
          success: false,
          error: (err as Error).message,
          errorCode: 'EXPO_NETWORK_ERROR',
          raw: { isPermanent: false }, // worth retrying
        })),
        ...invalidResults,
      ];
    }
  }

  // Phase 2: Receipt checking (optional)
  // Call this from a scheduled job ~15-30 minutes after sending to confirm
  // actual device delivery. receiptIds come from Phase 1 ticket.id values.
  //
  // @example
  // const receiptIds = logs
  //   .filter(l => l.status === 'SENT' && l.provider === 'expo')
  //   .map(l => l.messageId);
  // const results = await this.expoProvider.checkReceipts(receiptIds);
  async checkReceipts(
    receiptIds: ExpoPushReceiptId[],
  ): Promise<Map<ExpoPushReceiptId, ProviderResult>> {
    const results = new Map<ExpoPushReceiptId, ProviderResult>();
    const chunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);

    for (const chunk of chunks) {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);

      for (const [id, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'ok') {
          results.set(id, { success: true, messageId: id });
        } else {
          const errorCode = receipt.details?.error ?? 'UnknownError';
          const isPermanent = INVALID_TOKEN_ERRORS.has(errorCode);
          results.set(id, {
            success: false,
            error: receipt.message,
            errorCode,
            raw: { isPermanent, details: receipt.details },
          });
        }
      }
    }

    return results;
  }
}

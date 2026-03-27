import { Injectable, Logger } from '@nestjs/common';
import {
  Expo,
  ExpoPushMessage,
  ExpoPushReceiptId,
  ExpoPushTicket,
} from 'expo-server-sdk';
import { NotificationConfig } from '../../../notification.config';
import {
  IPushProvider,
  ProviderResult,
  PushPayload,
} from '../../../notification.interfaces';

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
  // The PushChannelService calls this when a user has multiple devices.
  async sendBatch(payloads: PushPayload[]): Promise<ProviderResult[]> {
    // Step 1: Separate valid Expo tokens from invalid ones
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
    }));

    try {
      // ── Step 3: Chunk and send ───────────────────────────────────────────
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
      }

      // ── Step 4: Map tickets to ProviderResult ────────────────────────────
      const validResults: ProviderResult[] = tickets.map((ticket) => {
        if (ticket.status === 'ok') {
          return {
            success: true,
            messageId: ticket.id,
          };
        }

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
            details: errTicket.details,
          },
        };
      });

      return [...validResults, ...invalidResults];
    } catch (err: unknown) {
      this.logger.error(
        `Expo batch send failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return [
        ...valid.map(() => ({
          success: false,
          error: (err as Error).message,
          errorCode: 'EXPO_NETWORK_ERROR',
          raw: { isPermanent: false },
        })),
        ...invalidResults,
      ];
    }
  }

  // Phase 2: Receipt checking (optional)
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

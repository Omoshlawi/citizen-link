import { NotificationChannel } from '../../generated/prisma/enums';

export enum EmailProviders {
  // SENDGRID = 'sendgrid',
  MAILPIT = 'mailpit',
  //   MAILGUN = 'mailgun',
  //   AWS_SES = 'aws-ses',
  //   RESEND = 'resend',
  //   SMTP = 'smtp',
  //   MOCK = 'mock',
}

export enum SmsProviders {
  TWILIO = 'twilio',
  //   AWS_SNS = 'aws-sns',
  //   NEXMO = 'nexmo',
  //   PLIVO = 'plivo',
  //   MOCK = 'mock',
  AFRICASTALK = 'africastalk',
}

export enum PushProviders {
  //   FCM = 'fcm',
  //   APNS = 'apns',
  EXPO = 'expo',
  //   MOCK = 'mock',
}

/** Root configuration passed to NotificationsModule.register() in app.module.ts */
export type NotificationModuleOptions = {
  global?: boolean;
  channels: {
    email: { providers: EmailProviders[] };
    sms: { providers: SmsProviders[] };
    push: { providers: PushProviders[] };
  };
};

// ─── Channel Payloads ────────────────────────────────────────────────────────
// These are the resolved, ready-to-send structures passed to each channel service.

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SmsPayload {
  to: string;
  body: string;
  from?: string;
}

export interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
  channelId?: string;
}

// ─── Queue Job Types ──────────────────────────────────────────────────────────

/**
 * Describes the content source of a notification job.
 * Either a DB template (rendered at processing time) or inline content
 * (provided directly at dispatch time, no template lookup needed).
 */
export type NotificationJobSource =
  | { type: 'template'; templateKey: string; data: Record<string, unknown> }
  | {
      type: 'inline';
      email?: { subject: string; html: string };
      sms?: { body: string };
      push?: { title: string; body: string; data?: Record<string, unknown> };
    };

/**
 * The payload stored in BullMQ for each delivery job.
 * One job is created per channel, and per push token for PUSH
 * (each device gets its own independent job and retry lifecycle).
 */
export interface NotificationJob {
  /** ID of the NotificationLog row created at dispatch time */
  logId: string;
  channel: NotificationChannel;
  source: NotificationJobSource;
  recipient: NotificationRecipient;
  userId?: string;
  force?: boolean;
  /** Zero-based retry counter — incremented by BullMQ on each attempt */
  attempt: number;
}

// ─── Provider Result ──────────────────────────────────────────────────────────

/** Returned by every channel provider after a send attempt */
export interface ProviderResult {
  success: boolean;
  /** Provider's own message ID — stored in NotificationLog.metadata for PUSH receipt checks */
  messageId?: string;
  error?: string;
  raw?: unknown;
  errorCode?: string;
  /** Set by the channel service on success, stored in NotificationLog.provider */
  providerName?: string;
}

// ─── Provider Interfaces ──────────────────────────────────────────────────────

export interface IEmailProvider {
  readonly name: string;
  send(payload: EmailPayload): Promise<ProviderResult>;
}

export interface ISmsProvider {
  readonly name: string;
  send(payload: SmsPayload): Promise<ProviderResult>;
}

export interface IPushProvider {
  readonly name: string;
  send(payload: PushPayload): Promise<ProviderResult>;
  sendBatch?(payloads: PushPayload[]): Promise<ProviderResult[]>;
  /**
   * Phase-2 receipt check — called ~15 min after send to confirm actual device delivery.
   * Only implemented by Expo push provider.
   */
  checkReceipts?(receiptIds: string[]): Promise<Map<string, ProviderResult>>;
}

// ─── Receipt Check Job ────────────────────────────────────────────────────────

/**
 * Payload for the Phase-2 Expo push receipt check job.
 * Enqueued automatically ~15 minutes after a successful PUSH send.
 * Confirms actual device delivery and deactivates stale push tokens.
 */
export interface PushReceiptJob {
  /** NotificationLog row to update with final delivery status */
  logId: string;
  /** Expo message ID returned during Phase-1 send, stored in NotificationLog.metadata */
  receiptId: string;
  /** Push token — used to deactivate on permanent errors (DeviceNotRegistered, etc.) */
  token: string;
}

// ─── Send Options ─────────────────────────────────────────────────────────────

/**
 * Contact addresses for delivery. All fields are optional — any omitted field
 * is auto-resolved from the user record at dispatch time using `userId`:
 *
 * - `email`      → `User.email`       (loaded when EMAIL channel is active)
 * - `phone`      → `User.phoneNumber` (loaded when SMS channel is active)
 * - `pushTokens` → `PushToken[]`      (loaded when PUSH channel is active)
 *
 * Explicitly provided values always take precedence over auto-loaded ones,
 * so you can override to a specific address when needed.
 */
export interface NotificationRecipient {
  email?: string;
  /** E.164 format: +254712345678 */
  phone?: string;
  pushTokens?: string[];
}

export enum NotificationPriority {
  /** OTP, security alerts, anything force-sent. Concurrency: 10. */
  HIGH = 'high',
  /** Case confirmations, status updates, reminders. Concurrency: 5. */
  NORMAL = 'normal',
  /** Marketing, digests. Concurrency: 2. */
  LOW = 'low',
}

/**
 * Fields shared by all send methods.
 *
 * ## NotificationEvent fields (eventTitle / eventBody / eventDescription)
 *
 * Every dispatch creates one `NotificationEvent` record that acts as the
 * umbrella for all channel deliveries. This is what the user sees in their
 * notification inbox — one entry regardless of how many channels or devices
 * were targeted.
 *
 * - `eventTitle` — short, human-friendly heading, e.g. `"Document Verified"`.
 *   Falls back to the template key or push title if omitted.
 * - `eventBody` — the user-facing message shown below the title,
 *   e.g. `"Document ABCD passed verification"`.
 * - `eventDescription` — internal/admin context explaining *why* the
 *   notification was sent. Never shown to end users. Useful for audit trails
 *   and support debugging, e.g. `"Notify finder of successful verification of document ABC"`.
 *
 * The channel deliveries (one per channel, one per push token for PUSH) are
 * recorded as `NotificationLog` rows linked to the event. Each log tracks
 * its own status, retry count, and error details independently.
 */
interface BaseOptions {
  /**
   * Contact addresses for delivery. Fully optional — omitted fields are
   * auto-resolved from the user record via `userId` at dispatch time.
   * Explicit values always take precedence over auto-loaded ones.
   */
  recipient?: NotificationRecipient;

  /** Restrict to specific channels. Defaults to all active channels. */
  channels?: NotificationChannel[];

  /**
   * ID of the user this notification belongs to.
   *
   * **Required.** Without a `userId`:
   * - No `NotificationEvent` can be created (the model has a non-nullable `userId` FK).
   * - The notification is delivered but leaves no inbox entry — invisible to the user.
   * - Preference/quiet-hour checks, push-token auto-loading, and read/delete tracking
   *   all require a user context.
   *
   * For the admin test endpoint, pass the calling admin's own `user.id` so the
   * test notification appears in their inbox and is fully observable.
   */
  userId: string;

  /**
   * Bypass user preferences, quiet hours, and channel opt-outs.
   * Always set `true` for OTP, 2FA, and security alerts.
   */
  force?: boolean;

  /** Deliver at a specific future time. Mutually exclusive with delayMs. */
  scheduledAt?: Date;

  /** Delay delivery by a fixed number of milliseconds from now. */
  delayMs?: number;

  /** Queue priority. Defaults to NORMAL. */
  priority?: NotificationPriority;

  /**
   * Short human-friendly title for the notification inbox.
   * e.g. `"Document Verified"`, `"New Match Found"`, `"OTP Code"`
   *
   * Falls back to: push title → email subject → SMS body (first 80 chars) → template key → "Notification".
   */
  eventTitle?: string;

  /**
   * User-facing message body shown in the notification inbox.
   * e.g. `"Document ABCD successfully passed verification"`
   *
   * Falls back to: push body → email subject → SMS body → empty string.
   */
  eventBody?: string;

  /**
   * Internal description of why this notification was triggered.
   * Not shown to end users. Stored on the NotificationEvent for admin/support context.
   * e.g. `"Notify finder of successful verification of document ABC submitted on 2026-03-27"`
   */
  eventDescription?: string;
}

/**
 * Options for {@link NotificationDispatchService.sendFromTemplate}.
 * Use this when content is managed in the Template DB table.
 */
export interface SendTemplateOptions extends BaseOptions {
  /**
   * Key of a `Template` record in the database.
   * e.g. `'case.verified'`, `'auth.otp'`, `'case.matched'`
   *
   * Template slots rendered at job-processing time via Handlebars:
   * - EMAIL: `email_subject`, `email_body`
   * - SMS: `sms_body`
   * - PUSH: `push_title`, `push_body`, `push_data`, `push_channel`
   *
   * Active channels are controlled by `template.metadata.channels`.
   */
  templateKey: string;

  /** Handlebars context variables injected into template slots at render time. */
  data?: Record<string, unknown>;

  // Required on template-based sends — there is no channel content to fall back on
  // for deriving inbox copy, so these must always be provided explicitly.
  eventTitle: string;
  eventBody: string;
  eventDescription: string;
}

/**
 * Options for {@link NotificationDispatchService.sendInline}.
 * Use this for one-off sends where content is constructed in code
 * (OTP codes, dynamic alerts) rather than managed in the Template table.
 *
 * Only specify the channel objects you want — omitted channels are skipped entirely.
 */
export interface SendInlineOptions extends BaseOptions {
  email?: { subject: string; html: string };
  sms?: { body: string };
  push?: { title: string; body: string; data?: Record<string, unknown> };
}

/**
 * Options for {@link NotificationDispatchService.send}.
 * General-purpose method — accepts either template or inline content.
 * Prefer `sendFromTemplate()` or `sendInline()` at call sites for clarity.
 */
export interface SendNotificationOptions extends BaseOptions {
  templateKey?: string;
  data?: Record<string, unknown>;
  inlineContent?: {
    email?: { subject: string; html: string };
    sms?: { body: string };
    push?: { title: string; body: string; data?: Record<string, unknown> };
  };
}

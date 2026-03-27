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

export type NotificationModuleOptions = {
  global?: boolean;
  channels: {
    email: { providers: EmailProviders[] };
    sms: { providers: SmsProviders[] };
    push: { providers: PushProviders[] };
  };
};

// PAYLOADS
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

// QUEUE JOB

export type NotificationJobSource =
  | { type: 'template'; templateKey: string; data: Record<string, unknown> }
  | {
      type: 'inline';
      email?: { subject: string; html: string };
      sms?: { body: string };
      push?: { title: string; body: string; data?: Record<string, unknown> };
    };

export interface NotificationJob {
  logId: string;
  channel: NotificationChannel;
  source: NotificationJobSource;
  recipient: NotificationRecipient;
  userId?: string;
  force?: boolean;
  attempt: number;
}

// PROVIDER RESULT
export interface ProviderResult {
  success: boolean;
  messageId?: string; // provider's own message ID for tracking
  error?: string; // human-readable error if success is false
  raw?: unknown; // raw provider response — useful for debugging
  errorCode?: string; // provider-specific error code
  providerName?: string; // set by channel service on success
}

// PROVIDER INTERFACES

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
  /** Phase-2 receipt check — called ~15 min after send to confirm actual device delivery. */
  checkReceipts?(receiptIds: string[]): Promise<Map<string, ProviderResult>>;
}

// RECEIPT CHECK JOB (Phase-2 Expo push delivery confirmation)
export interface PushReceiptJob {
  logId: string;
  receiptId: string;
  token: string; // push token — needed to deactivate on permanent error
}

// SEND OPTIONS

export interface NotificationRecipient {
  email?: string;
  phone?: string; // E.164: +254712345678
  pushTokens?: string[]; // auto-loaded from DB when userId is provided
}

export enum NotificationPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

// SHARED BASE OPTIONS
// Fields common to all send methods
interface BaseOptions {
  recipient: NotificationRecipient;

  /** Which channels to send through. Defaults to all active channels. */
  channels?: NotificationChannel[];

  /** Associate with a user for preference + quiet-hours checks */
  userId?: string;

  /**
   * Bypass preferences, quiet hours, and opt-outs.
   * Use for OTP, security alerts, and other critical sends.
   */
  force?: boolean;

  /** Schedule delivery at a specific future time */
  scheduledAt?: Date;

  /** Alternatively delay by a fixed number of milliseconds */
  delayMs?: number;

  /** Queue priority — defaults to NORMAL */
  priority?: NotificationPriority;
}

// sendFromTemplate() options
export interface SendTemplateOptions extends BaseOptions {
  /** Key of a Template record in the DB e.g. 'order.confirmed' */
  templateKey: string;

  /** Handlebars context injected into template slots */
  data?: Record<string, unknown>;
}

// sendInline() options
// Only specify the channels you want — unused ones are ignored.
export interface SendInlineOptions extends BaseOptions {
  email?: { subject: string; html: string };
  sms?: { body: string };
  push?: { title: string; body: string; data?: Record<string, unknown> };
}

// send() options — general purpose, accepts either style
export interface SendNotificationOptions extends BaseOptions {
  templateKey?: string;
  data?: Record<string, unknown>;
  inlineContent?: {
    email?: { subject: string; html: string };
    sms?: { body: string };
    push?: { title: string; body: string; data?: Record<string, unknown> };
  };
}

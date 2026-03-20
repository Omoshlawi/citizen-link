import { NotificationChannel } from '../../generated/prisma/enums';

export enum EmailProviders {
  SENDGRID = 'sendgrid',
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

export type NotificationOptions = {
  emailProviders: EmailProviders[];
  smsProviders: SmsProviders[];
  pushProviders: PushProviders[];
};

export type NotificationModuleOptions = {
  global?: boolean;
  options: NotificationOptions;
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

export interface NotificationJob<T = EmailPayload | SmsPayload | PushPayload> {
  logId: string;
  channel: NotificationChannel;
  payload: T;
  attempt: number;
}

// PROVIDER RESULT
export interface ProviderResult {
  success: boolean;
  messageId?: string; // provider's own message ID for tracking
  error?: string; // human-readable error if success is false
  raw?: unknown; // raw provider response — useful for debugging
  errorCode?: string; // provider-specific error code
}

// Channel dispatcher interface
export interface IChannelDispatcher {
  readonly channel: NotificationChannel;
  dispatch(job: NotificationJob): Promise<ProviderResult>;
}

// Provider interfaces

export interface IChannelDispatcher {
  readonly channel: NotificationChannel;
  dispatch(job: NotificationJob): Promise<ProviderResult>;
}

export type DispatcherRegistry = Map<NotificationChannel, IChannelDispatcher>;

export interface ISmsProvider {
  readonly name: string;
  send(payload: SmsPayload): Promise<ProviderResult>;
}

export interface IPushProvider {
  readonly name: string;
  send(payload: PushPayload): Promise<ProviderResult>;
  sendBatch?(payloads: PushPayload[]): Promise<ProviderResult[]>;
}

// SEND OPTIONS

export interface NotificationRecipient {
  email?: string;
  phone?: string;
  pushTokens?: string[];
  userId?: string;
}

export enum NotificationQueue {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

export interface SendNotificationOptions {
  templateKey?: string;
  inlineContent?: {
    email?: { subject: string; html: string };
    sms?: { body: string };
    push?: { title: string; body: string; data?: Record<string, unknown> };
  };
  channels?: NotificationChannel[];
  recipient: NotificationRecipient;
  data?: Record<string, unknown>;
  scheduledAt?: Date;
  delayMs?: number;
  priority?: NotificationQueue;
  userId?: string;
  force?: boolean;
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
}

export const NOTIFICATION_OPTIONS_TOKEN = 'NOTIFICATION_OPTIONS';

//
// Queue name constants owned by the notifications feature.
// Import these wherever you need @InjectQueue() or @Processor().
// Never use raw strings — one typo causes a silent mismatch.

export const NOTIFICATION_QUEUES = {
  HIGH: 'notifications-high', // OTP, security alerts, force: true sends
  NORMAL: 'notifications-normal', // order confirmations, reminders
  LOW: 'notifications-low', // marketing, digests
  PUSH_RECEIPT: 'notifications-push-receipt', // Phase-2 Expo delivery receipt checks (~15 min delay)
} as const;

export type NotificationQueueName =
  (typeof NOTIFICATION_QUEUES)[keyof typeof NOTIFICATION_QUEUES];

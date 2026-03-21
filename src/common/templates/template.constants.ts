import { SlotContract, TemplateType } from './templates.interfaces';

// Notification

export const NOTIFICATION_CONTRACT: SlotContract<
  (typeof NOTIFICATION_SLOTS)[keyof typeof NOTIFICATION_SLOTS]
> = {
  // At least one delivery slot is required
  required: [],
  optional: [
    'email_subject',
    'email_body',
    'sms_body',
    'push_title',
    'push_body',
    'push_data',
    'push_channel',
  ],
};

// Slot name constants — use these instead of magic strings
export const NOTIFICATION_SLOTS = {
  EMAIL_SUBJECT: 'email_subject',
  EMAIL_BODY: 'email_body',
  SMS_BODY: 'sms_body',
  PUSH_TITLE: 'push_title',
  PUSH_BODY: 'push_body',
  PUSH_DATA: 'push_data', // JSON string for deep linking
  PUSH_CHANNEL: 'push_channel', // Android notification channel ID
} as const;

// AI Prompt

export const PROMPT_CONTRACT: SlotContract<
  (typeof PROMPT_SLOTS)[keyof typeof PROMPT_SLOTS]
> = {
  required: ['user'], // user message is always required
  optional: ['system', 'assistant_prefix'], // system prompt and priming prefix
};

export const PROMPT_SLOTS = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT_PREFIX: 'assistant_prefix',
} as const;

// Report / Document

export const REPORT_CONTRACT: SlotContract<
  (typeof REPORT_SLOTS)[keyof typeof REPORT_SLOTS]
> = {
  required: ['title', 'body'],
  optional: ['header', 'footer', 'summary', 'styles'],
};

export const REPORT_SLOTS = {
  TITLE: 'title',
  HEADER: 'header',
  BODY: 'body',
  SUMMARY: 'summary',
  FOOTER: 'footer',
  STYLES: 'styles',
} as const;

// Invoice

export const INVOICE_CONTRACT: SlotContract<
  (typeof INVOICE_SLOTS)[keyof typeof INVOICE_SLOTS]
> = {
  required: ['header', 'line_items', 'totals'],
  optional: ['notes', 'payment_instructions', 'footer'],
};

export const INVOICE_SLOTS = {
  HEADER: 'header',
  LINE_ITEMS: 'line_items',
  TOTALS: 'totals',
  NOTES: 'notes',
  PAYMENT_INSTRUCTIONS: 'payment_instructions',
  FOOTER: 'footer',
} as const;

// Registry — maps type string → contract
// Add new type here and TemplateService picks it up automatically.

export const CONTRACT_REGISTRY: Record<TemplateType, SlotContract<string>> = {
  notification: NOTIFICATION_CONTRACT,
  prompt: PROMPT_CONTRACT,
  report: REPORT_CONTRACT,
  document: REPORT_CONTRACT, // documents reuse the report contract
  invoice: INVOICE_CONTRACT,
};

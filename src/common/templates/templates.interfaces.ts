// Return types
export interface RenderedSlots {
  templateId: string;
  key: string;
  type: string;
  metadata: Record<string, unknown> | null;
  slots: Record<string, string>; // only slots that were present + rendered
}

export interface RenderOneResult {
  templateId: string;
  key: string;
  type: string;
  metadata: Record<string, unknown> | null;
  rendered: string;
}

// Base
export interface SlotContract<T extends string> {
  required: T[];
  optional?: T[];
}

export enum TemplateType {
  NOTIFICATION = 'notification',
  PROMPT = 'prompt',
  REPORT = 'report',
  DOCUMENT = 'document',
  INVOICE = 'invoice',
}

//   Notification
export interface NotificationMetadata {
  channels: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
}

export interface PromptMetadata {
  model?: string; // e.g. 'claude-sonnet-4-6'
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  // Output parsing hints
  outputFormat?: 'text' | 'json' | 'markdown';
  jsonSchema?: Record<string, unknown>;
}

export interface ReportMetadata {
  format?: 'pdf' | 'html' | 'docx' | 'markdown';
  pageSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  logo?: string; // URL
  primaryColor?: string;
}

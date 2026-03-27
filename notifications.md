# Notification System

The notification system is a multi-channel, multi-provider delivery engine built on **BullMQ** (Redis-backed job queues). It supports **email**, **SMS**, and **push** channels, each with its own ordered provider fallback chain. Every delivery attempt is persisted in a `NotificationLog` row for full observability.

---

## Table of contents

1. [Architecture overview](#architecture-overview)
2. [Sending notifications](#sending-notifications)
3. [Channels and providers](#channels-and-providers)
4. [Template slots](#template-slots)
5. [Queue internals](#queue-internals)
6. [Notification log](#notification-log)
7. [REST API](#rest-api)
8. [Quiet hours and preferences](#quiet-hours-and-preferences)
9. [Push token management](#push-token-management)
10. [Environment variables](#environment-variables)
11. [Adding a new provider to an existing channel](#adding-a-new-provider-to-an-existing-channel)
12. [Adding a new channel](#adding-a-new-channel)
13. [Testing locally](#testing-locally)

---

## Architecture overview

```
caller
  └─ NotificationDispatchService.sendFromTemplate() / sendInline() / sendBulk()
       ├─ filterAllowedChannels()  ← user prefs + quiet hours
       ├─ creates NotificationLog row (status: PENDING)
       └─ enqueues NotificationJob to HIGH / NORMAL / LOW queue
            └─ BullMQ worker picks up job
                 └─ NotificationProcessorHandler.process()
                      ├─ mark log QUEUED
                      ├─ auto-load push tokens (if userId, no tokens given)
                      ├─ NotificationContentResolver.resolve()  ← render template / map inline
                      ├─ persist resolved body to log
                      └─ EmailChannelService / SmsChannelService / PushChannelService
                           └─ tries Provider 1 → Provider 2 → … (fallback chain)
                      └─ updates NotificationLog (status, provider, attempts, sentAt)
```

**Key files**

| File | Role |
|---|---|
| `notifications.dispatch.service.ts` | Public API — call this from other modules |
| `notification.processor.handler.ts` | BullMQ job handler (retry / fallback logic) |
| `notification.content.resolver.ts` | Resolves template / inline content per channel |
| `channels/email/email.channel.service.ts` | Email provider fallback loop |
| `channels/sms/sms.channel.service.ts` | SMS provider fallback loop |
| `channels/push/push.channel.service.ts` | Push provider fallback loop |
| `notification.interfaces.ts` | All shared types and enums |
| `notification.config.ts` | Env var bindings |
| `notification.constants.ts` | Queue names and other constants |

---

## Sending notifications

Inject `NotificationDispatchService` into any module and call one of the three send methods. The module is registered globally so no extra imports are needed.

```typescript
constructor(private readonly notifications: NotificationDispatchService) {}
```

### `sendFromTemplate()` — DB template (preferred)

Templates are stored in the `Template` table with a key string and Handlebars slots for each channel. See [Template slots](#template-slots) for how to structure template content.

```typescript
await this.notifications.sendFromTemplate({
  templateKey: 'document.found',
  recipient: {
    email: user.email,
    phone: user.phone,    // E.164 format: +254712345678
    pushTokens: [],       // auto-loaded from DB when userId is provided
  },
  data: {
    documentType: 'National ID',
    caseId: case.id,
  },
  userId: user.id,          // enables preference checks and quiet-hours filtering
  channels: [NotificationChannel.EMAIL, NotificationChannel.SMS], // optional subset
  force: false,             // true = bypass opt-outs (use for OTP / security alerts)
  priority: NotificationPriority.HIGH,
  scheduledAt: new Date('2026-03-28T09:00:00Z'), // optional future delivery
});
```

### `sendInline()` — no template needed

Use for one-off messages where DB templates would be overkill (OTPs, system alerts). Only include the channel keys you want — unused channels are ignored.

```typescript
// SMS only
await this.notifications.sendInline({
  recipient: { phone: user.phone },
  sms: { body: `Your OTP is ${otp}. Valid for 5 minutes.` },
  force: true,   // bypass quiet hours for OTPs
  priority: NotificationPriority.HIGH,
});

// Email + push, no SMS
await this.notifications.sendInline({
  recipient: { email: user.email },
  email: { subject: 'Case update', html: '<p>Your case was matched.</p>' },
  push: { title: 'Case update', body: 'Your case was matched.' },
  userId: user.id,
});
```

### `sendBulk()` — same template, many recipients

Uses BullMQ `addBulk()` — one Redis round-trip per page of recipients. Ideal for broadcasts and digests.

```typescript
await this.notifications.sendBulk({
  templateKey: 'marketing.weekly',
  priority: NotificationPriority.LOW,
  recipients: users.map(u => ({
    userId: u.id,
    recipient: { email: u.email, phone: u.phone },
    data: { firstName: u.firstName },
  })),
});
```

### Common options reference

| Option | Type | Default | Description |
|---|---|---|---|
| `recipient` | `NotificationRecipient` | required | `{ email?, phone?, pushTokens? }` |
| `userId` | `string` | — | Links log to user; enables preference / quiet-hours filtering |
| `channels` | `NotificationChannel[]` | all configured | Restrict to a subset of channels |
| `force` | `boolean` | `false` | Bypass all user opt-outs and quiet hours |
| `priority` | `NotificationPriority` | `NORMAL` | Routes to HIGH / NORMAL / LOW queue |
| `scheduledAt` | `Date` | — | Deliver at a future time |
| `delayMs` | `number` | — | Relative delay in milliseconds |

---

## Channels and providers

### Registration

Providers are registered per channel in the module options passed to `NotificationsModule.register()`. The **order of the array determines the fallback order** — index 0 is tried first.

```typescript
// app.module.ts
NotificationsModule.register({
  global: true,
  channels: {
    email: { providers: [EmailProviders.MAILPIT] },
    sms:   { providers: [SmsProviders.TWILIO, SmsProviders.AFRICASTALK] },
    push:  { providers: [PushProviders.EXPO] },
  },
}),
```

### Fallback behaviour

When a provider fails, the channel service logs a warning and tries the next one. All provider errors are aggregated and returned only if every provider fails.

```
[1/2] Trying twilio for +254712345678
[1/2] twilio failed: Network timeout
[2/2] Trying africastalking for +254712345678
→ success — log.provider = 'africastalking'
```

The `NotificationLog.provider` field is written **after** delivery succeeds, so it always reflects the provider that actually sent the message.

### Built-in providers

| Channel | Provider | Enum key |
|---|---|---|
| Email | Mailpit / any SMTP | `EmailProviders.MAILPIT` |
| SMS | Twilio | `SmsProviders.TWILIO` |
| SMS | AfricasTalking | `SmsProviders.AFRICASTALK` |
| Push | Expo Push API | `PushProviders.EXPO` |

### Provider result type

Every provider returns a `ProviderResult`:

```typescript
interface ProviderResult {
  success: boolean;
  messageId?: string;     // provider's own message ID
  error?: string;         // human-readable failure reason
  errorCode?: string;     // provider-specific code (e.g. DeviceNotRegistered)
  isPermanent?: boolean;  // true = do not retry (e.g. invalid push token)
  raw?: unknown;          // raw provider response for debugging
  providerName?: string;  // set by channel service on success
}
```

---

## Template slots

Templates are Handlebars documents stored in the database. Each template can carry content for multiple channels by embedding **named slots** that the content resolver extracts at delivery time.

| Slot name | Used by | Description |
|---|---|---|
| `EMAIL_SUBJECT` | Email | Subject line |
| `EMAIL_BODY` | Email | Full HTML body |
| `SMS_BODY` | SMS | Plain-text message (keep under ~160 chars) |
| `PUSH_TITLE` | Push | Notification title |
| `PUSH_BODY` | Push | Notification body text |
| `PUSH_DATA` | Push | Optional JSON data payload (stringified) |

Handlebars context variables (from the `data` option) are available inside every slot:

```handlebars
{{! EMAIL_SUBJECT }}
Your document case {{caseId}} has been matched

{{! EMAIL_BODY }}
<p>Hello {{firstName}},</p>
<p>A match was found for your <strong>{{documentType}}</strong>.</p>

{{! PUSH_TITLE }}
Match found — {{documentType}}

{{! PUSH_BODY }}
Tap to view your matched case.
```

---

## Queue internals

### Three priority queues

| Queue name | Concurrency | Intended use |
|---|---|---|
| `notifications-high` | 10 | OTPs, security alerts, `force: true` sends |
| `notifications-normal` | 5 | Confirmations, case status updates |
| `notifications-low` | 2 | Marketing, digests, bulk sends |

Priority is passed via `NotificationPriority`:

```typescript
export enum NotificationPriority {
  HIGH   = 'high',
  NORMAL = 'normal',
  LOW    = 'low',
}
```

### Job retention

| Outcome | TTL |
|---|---|
| Completed jobs | 24 hours |
| Failed jobs | 7 days |

### Retry and backoff

BullMQ handles retries automatically. The default is **3 attempts** with exponential backoff. Each attempt increments `NotificationLog.attempts`. When all attempts are exhausted, `onFailed` flips the status to `FAILED`.

To change the retry config, adjust the queue registration in `notifications.module.ts`:

```typescript
BullMQAdapter.register({
  queues: [NOTIFICATION_QUEUES.HIGH],
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
  },
})
```

### Bull Board dashboard

A visual queue dashboard is available at `/api/queues` (requires admin access). It shows pending, active, completed, and failed jobs for all three queues.

---

## Notification log

Every send attempt creates a `NotificationLog` row. The status lifecycle is:

```
PENDING → QUEUED → SENT
                 → FAILED   (all retries exhausted)
                 → SKIPPED  (no content for channel / suppressed by preferences)
```

| Field | Description |
|---|---|
| `channel` | `EMAIL` / `SMS` / `PUSH` |
| `provider` | Which provider actually delivered (e.g. `twilio`, `mailpit`, `expo`) |
| `status` | Current state (see above) |
| `attempts` | How many attempts were made |
| `maxAttempts` | Retry limit (default 3) |
| `sentAt` | Timestamp of successful delivery |
| `lastError` | Error message from last failed attempt |
| `body` | Resolved message body (HTML for email, text for SMS/push) |
| `to` | Resolved recipient address / phone / token |
| `subject` | Email subject (email channel only) |
| `metadata` | Arbitrary JSON — passed through from job |
| `voided` | Soft-delete flag |

---

## REST API

```
GET    /api/notifications        paginated list (users see their own; admins see all)
GET    /api/notifications/:id    single log
DELETE /api/notifications/:id    admin only (requires notification:delete permission)
POST   /api/notifications/test   admin only (requires notification:test permission)
```

### Query parameters for `GET /api/notifications`

| Param | Description |
|---|---|
| `channel` | Filter by `EMAIL`, `SMS`, or `PUSH` |
| `status` | Filter by `PENDING`, `QUEUED`, `SENT`, `FAILED`, or `SKIPPED` |
| `userId` | Filter by user (admin only) |
| `from` | Start of date range (ISO 8601) |
| `to` | End of date range (ISO 8601) |
| `orderBy` | Column to sort by |
| `page` | Page number (1-indexed) |
| `limit` | Results per page |

### `POST /api/notifications/test` body

```typescript
{
  templateKey?: string;
  inlineContent?: {
    email?: { subject: string; html: string };
    sms?: { body: string };
    push?: { title: string; body: string; data?: Record<string, unknown> };
  };
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  recipient: {
    email?: string;
    phone?: string;
    pushTokens?: string[];
  };
}
```

---

## Quiet hours and preferences

`NotificationContentResolver.filterAllowedChannels()` is called before enqueueing. It filters out channels based on:

- **User opt-outs** — user has disabled a channel globally in their settings
- **Quiet hours** — current time (in the user's timezone) falls inside the configured window
- **Per-template overrides** — user has overridden a specific template's channel preferences

Pass `force: true` to bypass all of these (for OTPs, security alerts, etc.).

### Preference schema (stored as user settings)

```typescript
{
  email: boolean;                    // global email on/off
  sms: boolean;                      // global SMS on/off
  push: boolean;                     // global push on/off
  timezone?: string;                 // IANA timezone (default: UTC)
  quietHoursStart?: number;          // 0–23, inclusive start of quiet window
  quietHoursEnd?: number;            // 0–23, exclusive end of quiet window
  overrides?: Record<string, {       // keyed by templateKey
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  }>;
}
```

**Quiet hours during overnight ranges work correctly** — e.g. `start: 22, end: 8` will suppress notifications from 10 pm through 7:59 am.

During quiet hours, **only EMAIL is suppressed for non-forced sends**. This reflects a design choice that SMS and push are more disruptive at night than email.

---

## Push token management

Push tokens are stored in the `UserPushToken` model (table `user_push_tokens`). The processor automatically loads them if `userId` is provided and `pushTokens` is empty in the recipient.

**`PushTokenService`** (`src/push-token/push-token.service.ts`):

```typescript
// Retrieve all active tokens for a user
getPushTokens(userId: string): Promise<string[]>

// Permanently deactivate a token (called automatically on DeviceNotRegistered error)
deactivatePushToken(token: string): Promise<void>
```

When the Expo provider receives a `DeviceNotRegistered` or `InvalidCredentials` error for a token, it marks `isPermanent: true` in the result. The processor handler intercepts this, calls `deactivatePushToken()`, and prevents future sends to that token — no manual cleanup needed.

**Two-phase Expo delivery** (handled internally by `ExpoPushProvider`):

1. **Phase 1** — POST messages to Expo, receive tickets with a `receiptId`
2. **Phase 2** (optional, ~15 min later) — call `checkReceipts(receiptIds)` to confirm actual device delivery. This is useful for auditing but is not wired into the automatic flow by default.

---

## Environment variables

### Email (Mailpit / SMTP)

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | `localhost` | SMTP server host |
| `SMTP_PORT` | `1025` | SMTP server port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASSWORD` | — | SMTP password |
| `SMTP_FROM` | `"No Reply" <noreply@example.com>` | Sender address |
| `SMTP_NAME` | `No Reply` | Sender display name |

### SMS — Twilio

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Account SID from Twilio console |
| `TWILIO_AUTH_TOKEN` | Auth token from Twilio console |
| `TWILIO_FROM_NUMBER` | E.164 sender number e.g. `+15005550006` |

### SMS — AfricasTalking

| Variable | Description |
|---|---|
| `AFRICASTALKING_API_KEY` | API key from AT dashboard |
| `AFRICASTALKING_USERNAME` | AT account username (`sandbox` for testing) |
| `AFRICASTALKING_SENDER_ID` | Optional alphanumeric sender ID |

### Push — Expo

| Variable | Description |
|---|---|
| `EXPO_ACCESS_TOKEN` | Expo push access token (optional for low-volume use) |

---

## Adding a new provider to an existing channel

Example: adding **Resend** as an email provider fallback.

### 1. Add the enum value

```typescript
// notification.interfaces.ts
export enum EmailProviders {
  MAILPIT = 'mailpit',
  RESEND  = 'resend',   // ← add
}
```

### 2. Create the provider class

```typescript
// channels/email/providers/resend.provider.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { NotificationConfig } from '../../../notification.config';
import { EmailPayload, IEmailProvider, ProviderResult } from '../../../notification.interfaces';

@Injectable()
export class ResendProvider implements IEmailProvider {
  readonly name = 'resend';

  constructor(private readonly config: NotificationConfig) {}

  async send(payload: EmailPayload): Promise<ProviderResult> {
    try {
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: this.config.smtpFrom,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
        },
        { headers: { Authorization: `Bearer ${this.config.resendApiKey}` } },
      );
      return { success: true, messageId: response.data.id };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message ?? err.message };
    }
  }
}
```

### 3. Add config fields for new env vars

```typescript
// notification.config.ts
@Value('RESEND_API_KEY')
resendApiKey?: string;
```

### 4. Wire it into the channel module

```typescript
// channels/email/email.channel.module.ts — inside the provider map
[EmailProviders.RESEND]: ResendProvider,
```

### 5. Register it in module options (controls fallback order)

```typescript
NotificationsModule.register({
  channels: {
    email: { providers: [EmailProviders.MAILPIT, EmailProviders.RESEND] },
    //                   ↑ tried first              ↑ fallback
    ...
  },
});
```

No other changes needed. The channel service loops over the registered providers in order automatically.

---

## Adding a new channel

Example: adding a **WhatsApp** channel.

### 1. Add the channel to the Prisma enum

```prisma
// prisma/schema.prisma
enum NotificationChannel {
  EMAIL
  SMS
  PUSH
  WHATSAPP   // ← add
}
```

Then run `npx prisma migrate dev`.

### 2. Define payload type, provider interface, and provider enum

```typescript
// notification.interfaces.ts

export interface WhatsAppPayload {
  to: string;         // E.164 phone number
  body: string;
  mediaUrl?: string;
}

export interface IWhatsAppProvider {
  readonly name: string;
  send(payload: WhatsAppPayload): Promise<ProviderResult>;
}

export enum WhatsAppProviders {
  TWILIO_WA = 'twilio-wa',
}

// Also extend NotificationModuleOptions:
channels: {
  whatsapp?: { providers: WhatsAppProviders[] };
  // ... existing channels
}
```

### 3. Create the channel service

Copy the pattern from `sms.channel.service.ts`:

```typescript
// channels/whatsapp/whatsapp.channel.service.ts
@Injectable()
export class WhatsAppChannelService {
  private readonly logger = new Logger(WhatsAppChannelService.name);

  constructor(private readonly providers: IWhatsAppProvider[]) {}

  async send(payload: WhatsAppPayload): Promise<ProviderResult> {
    if (!this.providers?.length) {
      return { success: false, error: 'No WhatsApp providers configured' };
    }
    const errors: string[] = [];
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      this.logger.log(`[${i + 1}/${this.providers.length}] Trying ${provider.name} for ${payload.to}`);
      const result = await provider.send(payload);
      if (result.success) return { ...result, providerName: provider.name };
      this.logger.warn(`[${i + 1}/${this.providers.length}] ${provider.name} failed: ${result.error}`);
      errors.push(`[${provider.name}] ${result.errorCode ?? ''} - ${result.error ?? ''}`);
    }
    return { success: false, error: 'Exhausted all WhatsApp providers: ' + errors.join(', ') };
  }
}
```

### 4. Create the channel module

Mirror `sms.channel.module.ts` — implement a `forProviders(providers: WhatsAppProviders[])` static factory that registers the provider classes.

### 5. Wire into the content resolver

Add a `WHATSAPP` case in `NotificationContentResolver.resolveFromTemplate()` and `resolveFromInline()` to extract or render the WhatsApp payload from the template slots / inline options.

### 6. Wire into the processor handler

```typescript
// notification.processor.handler.ts
case NotificationChannel.WHATSAPP:
  result = await this.whatsappChannel.send(payload as WhatsAppPayload);
  break;
```

### 7. Wire into the dispatch service

Add `NotificationChannel.WHATSAPP` to the `requestedChannels` defaults and add a case in `extractTo()` to pull `recipient.phone` (or a dedicated `whatsapp` field) as the destination address.

### 8. Register in module options

```typescript
NotificationsModule.register({
  channels: {
    whatsapp: { providers: [WhatsAppProviders.TWILIO_WA] },
    ...
  },
});
```

---

## Testing locally

1. Start the dev stack: `docker compose -f docker-compose.dev.yml up -d`
2. **Mailpit UI** (catches all outgoing email): [http://localhost:8025](http://localhost:8025)
3. **Bull Board** (queue dashboard): available at `/api/queues` (admin access required)
4. To test SMS locally, set `AFRICASTALKING_USERNAME=sandbox` and use the AT sandbox dashboard
5. For push, use the Expo Go app with a real Expo push token registered in the `user_push_tokens` table
6. Use `POST /api/notifications/test` (admin token required) to fire a test notification without writing application code

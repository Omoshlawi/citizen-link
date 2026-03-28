# Notification System

The notification system is a multi-channel, multi-provider delivery engine built on **BullMQ** (Redis-backed job queues). It supports **email**, **SMS**, and **push** channels, each with its own ordered provider fallback chain. Every delivery attempt is persisted in a `NotificationLog` row for full observability.

---

## Table of contents

1. [Architecture overview](#architecture-overview)
2. [Sending notifications](#sending-notifications)
3. [Channel selection pipeline](#channel-selection-pipeline)
4. [Channels and providers](#channels-and-providers)
5. [Template slots](#template-slots)
6. [Existing notification templates](#existing-notification-templates)
7. [Queue internals](#queue-internals)
8. [Notification log](#notification-log)
9. [REST API](#rest-api)
10. [Quiet hours and preferences](#quiet-hours-and-preferences)
11. [Push token management](#push-token-management)
12. [Environment variables](#environment-variables)
13. [Adding a new provider to an existing channel](#adding-a-new-provider-to-an-existing-channel)
14. [Adding a new channel](#adding-a-new-channel)
15. [Testing locally](#testing-locally)

---

## Architecture overview

```
caller
  └─ NotificationDispatchService.sendFromTemplate() / sendInline() / sendBulk()
       ├─ 1. filterAllowedChannels()     ← user prefs + quiet hours (bypassed by force:true)
       ├─ 2. template metadata filter    ← drops channels disabled in metadata.channels
       │      (template sends only; not bypassed by force)
       ├─ 3. recipient contact-info guard ← drops channels with no email / phone / token
       ├─ creates NotificationEvent row  (umbrella inbox record)
       ├─ creates NotificationLog row per channel (status: PENDING)
       └─ enqueues NotificationJob to HIGH / NORMAL / LOW queue
            └─ BullMQ worker picks up job
                 └─ NotificationProcessorHandler.process()
                      ├─ mark log QUEUED (first attempt only)
                      ├─ NotificationContentResolver.resolve()  ← render template / map inline
                      │    └─ returns null → mark log SKIPPED (last-resort guard)
                      ├─ persist resolved body to log
                      └─ EmailChannelService / SmsChannelService / PushChannelService
                           └─ tries Provider 1 → Provider 2 → … (fallback chain)
                      └─ updates NotificationLog (status, provider, attempts, sentAt)
                           └─ on PUSH success → enqueues Phase-2 receipt check (~15 min later)
```

**Key files**

| File | Role |
|---|---|
| `notifications.dispatch.service.ts` | Public API — call this from other modules |
| `notification.content.resolver.ts` | Resolves template / inline content per channel; runs channel preference filter |
| `notification.processor.handler.ts` | BullMQ job handler (shared by all three priority workers) |
| `notification.receipt.processor.ts` | Phase-2 Expo push receipt checker |
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
  templateKey: 'notification.case.found.matched',

  // recipient is optional — email and phone are auto-loaded from the User record
  // when userId is provided and they are not supplied here.
  recipient: {
    email: user.email,           // optional if userId provided
    phone: user.phone,           // E.164 format: +254712345678
    pushTokens: [],              // auto-loaded from DB when userId is provided
  },

  // Handlebars context: top-level keys map directly to {{variables}} in templates.
  data: { match },

  userId: user.id,              // enables preference checks and quiet-hours filtering
  force: false,                 // true = bypass opt-outs and quiet hours (use for OTP / security)
  priority: NotificationPriority.HIGH,

  // channels is optional — omit to let template metadata.channels decide.
  // Provide it only when you want to restrict a send to fewer channels than the template supports.
  // channels: [NotificationChannel.EMAIL],

  scheduledAt: new Date('2026-03-28T09:00:00Z'), // optional future delivery

  // All three event fields are REQUIRED (TypeScript compile error if omitted).
  eventTitle: 'Match Found',                           // shown in the in-app notification inbox
  eventBody:  'A potential match was found for your document.', // inbox body
  eventDescription: 'Match #42 — lost case ABC matched found case XYZ', // internal audit only
});
```

### `sendInline()` — no template needed

Use for one-off messages where a DB template would be overkill (OTPs, system alerts). **Always pass `channels` explicitly** — without it the system defaults to all three channels, creates jobs for each, and channels without matching inline content will SKIP in the worker.

```typescript
// SMS only
await this.notifications.sendInline({
  channels: [NotificationChannel.SMS],
  recipient: { phone: user.phone },
  sms: { body: `Your OTP is ${otp}. Valid for 5 minutes.` },
  userId: user.id,
  force: true,   // bypass quiet hours for OTPs
  priority: NotificationPriority.HIGH,
  eventTitle: 'OTP Code',
  eventBody:  'Your one-time password has been sent.',
  eventDescription: `OTP dispatched to user ${user.id}`,
});

// Email + push, no SMS
await this.notifications.sendInline({
  channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
  recipient: { email: user.email },
  email: { subject: 'Case update', html: '<p>Your case was matched.</p>' },
  push:  { title: 'Case update', body: 'Your case was matched.' },
  userId: user.id,
  eventTitle: 'Case Update',
  eventBody:  'Your case has been updated.',
  eventDescription: `Inline case-update notification for user ${user.id}`,
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
    eventTitle: 'Weekly Update',
    eventBody:  'Your weekly digest is ready.',
    eventDescription: `Weekly digest for user ${u.id}`,
  })),
});
```

### Common options reference

| Option | Type | Required | Description |
|---|---|---|---|
| `templateKey` | `string` | template sends | Key of the `Template` DB record |
| `data` | `Record<string, unknown>` | template sends | Handlebars context — top-level keys map to `{{variables}}` |
| `recipient` | `NotificationRecipient` | — | `{ email?, phone?, pushTokens? }` — missing fields auto-loaded via `userId` |
| `userId` | `string` | — | Links log to user; enables preference / quiet-hours filtering and auto recipient loading |
| `channels` | `NotificationChannel[]` | inline sends | Restrict channels. Omit for template sends to let `metadata.channels` decide |
| `force` | `boolean` | — | `false` (default). `true` bypasses user opt-outs and quiet hours |
| `priority` | `NotificationPriority` | — | `NORMAL` (default). Routes to HIGH / NORMAL / LOW queue |
| `scheduledAt` | `Date` | — | Deliver at a future time |
| `delayMs` | `number` | — | Relative delay in milliseconds |
| `eventTitle` | `string` | **required** | Heading shown in the in-app notification inbox |
| `eventBody` | `string` | **required** | Body text shown in the in-app notification inbox |
| `eventDescription` | `string` | **required** | Internal audit trail — never shown to end users |

---

## Channel selection pipeline

Every send — template or inline — passes through these four stages in order. **No log rows or BullMQ jobs are created for a channel until it clears all four stages.**

```
caller's channels  (or [EMAIL, SMS, PUSH] if omitted)
    │
    ▼  Stage 1 — User preferences + quiet hours
    │  NotificationContentResolver.filterAllowedChannels()
    │  • Per-channel opt-outs (user has disabled email / sms / push in settings)
    │  • Per-template-key overrides
    │  • Quiet hours: SMS and PUSH suppressed; EMAIL intentionally allowed (non-intrusive)
    │  Bypassed entirely when force:true.
    │
    ▼  Stage 2 — Template metadata.channels  (template sends only)
    │  enqueue() reads template.metadata.channels from DB
    │  • Drops any channel where metadata.channels[ch] === false
    │  • Acts as a hard ceiling — the template declares which channels it supports
    │  NOT bypassed by force:true.
    │
    ▼  Stage 3 — Recipient contact-info guard
    │  enqueue() checks resolved recipient before creating any DB rows
    │  • EMAIL dropped silently if recipient has no email address
    │  • SMS   dropped silently if recipient has no phone number
    │  • PUSH  dropped silently if recipient has no push tokens
    │
    ▼  Stage 4 — Worker-time content check  (last resort)
    │  NotificationContentResolver.resolve() inside the BullMQ worker
    │  • Returns null if payload cannot be built (malformed template, etc.)
    │  • Marks log SKIPPED — should not be reached in normal operation if stages 1-3 are correct
    │
    final channels → NotificationEvent + NotificationLog rows + BullMQ jobs
```

### Scenario quick reference

| Scenario | Starting channels | Stage 2 applies? | Effective channels |
|---|---|---|---|
| Template, no `channels` | `[E, S, P]` | Yes — `metadata.channels` narrows | Only what template enables |
| Template, `channels` provided | Caller's list | Yes — metadata can further narrow | Caller ∩ metadata |
| Inline, `channels` provided | Caller's list | No | Caller's list → stages 1, 3, 4 |
| Inline, no `channels` | `[E, S, P]` | No | All three → stages 1, 3, 4 (risky — always specify `channels` for inline) |

### `force: true` scope

`force: true` **only** bypasses Stage 1 (user preferences and quiet hours). It does not bypass Stage 2 (template metadata), Stage 3 (contact-info guard), or Stage 4 (worker content check). Required for OTP, security alerts, and email verification.

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

`NotificationLog.provider` is written **after** delivery succeeds, so it always reflects the provider that actually sent the message.

### Built-in providers

| Channel | Provider | Enum key | Active by default |
|---|---|---|---|
| Email | Mailpit / any SMTP | `EmailProviders.MAILPIT` | Yes |
| SMS | Twilio | `SmsProviders.TWILIO` | No |
| SMS | AfricasTalking | `SmsProviders.AFRICASTALK` | No |
| Push | Expo Push API | `PushProviders.EXPO` | Yes |

### Provider result type

Every provider returns a `ProviderResult`:

```typescript
interface ProviderResult {
  success: boolean;
  messageId?: string;     // provider's own message ID (stored as receiptId for push)
  error?: string;         // human-readable failure reason
  errorCode?: string;     // provider-specific code (e.g. DeviceNotRegistered)
  isPermanent?: boolean;  // true = do not retry (e.g. invalid push token)
  raw?: unknown;          // raw provider response for debugging
  providerName?: string;  // set by channel service on success
}
```

---

## Template slots

Templates are Handlebars documents stored in the `Template` DB table. Each template carries content for one or more channels via **named slots** that the content resolver extracts at delivery time. The `data` object from `sendFromTemplate` becomes the **top-level Handlebars context** — keys must match `{{variable}}` paths exactly.

| Slot name | Used by | Notes |
|---|---|---|
| `email_subject` | EMAIL | Plain text; rendered as Handlebars |
| `email_body` | EMAIL | Full HTML document |
| `sms_body` | SMS | Plain text; ≤ 160 chars recommended |
| `push_title` | PUSH | Short — shown as the OS notification title |
| `push_body` | PUSH | One or two sentences |
| `push_data` | PUSH | Valid JSON string for deep linking, e.g. `{"screen":"match","matchId":"{{match.id}}"}` |
| `push_channel` | PUSH | Android notification channel ID (defaults to `"default-v2"` if absent) |

`push_data` must be valid JSON. If malformed the push is still sent — just without deep-link data.

### `metadata.channels`

Every notification template must declare which channels it supports:

```json
{ "channels": { "email": true, "sms": false, "push": true } }
```

This is the **authoritative** per-template channel config. Only define slots for enabled channels — unused slots are ignored by the resolver. The dispatch service reads this metadata before creating any log rows or jobs (Stage 2 of the pipeline).

### Template seed workflow

Template seed data lives in `assets/json/templates.json`; HTML email bodies in `assets/templates/mail/*.hbs`. The seeder resolves each slot's `source` at seed time:

- `"source": "file"` → reads the `.hbs` file content and stores the full HTML in the DB slot
- `"source": "text"` → stores the inline string directly

```bash
pnpm db:seed    # upsert all templates into the DB
```

**After editing any `.hbs` file or `templates.json`, always re-run `pnpm db:seed`** — the DB slots are what the renderer uses at runtime, not the source files.

### Naming conventions

| Field | Convention | Example |
|---|---|---|
| `key` | Domain-namespaced dot notation | `notification.case.*`, `auth.*` |
| `name` | Short noun phrase, title case, no "Notification" suffix | `"Owner Match Found"` |
| `description` | "Sent to \<recipient\> when \<trigger\>." | `"Sent to the owner when a matching found report is identified."` |
| `email_subject` | Event + identifier. Auth flows: prefix `"Action Required: "` | `"Match Found for Your Lost Case #{{match.lostDocumentCase.case.caseNumber}} — Action Required"` |

### CTA links in email templates

All action buttons and links in email templates use the **`citizenlinkapp://`** deep-link scheme — not `https://citizenlink.app` — because there is currently no public web-facing interface. Footer fallback text should say "open the app and navigate to…" rather than "paste this link into your browser".

---

## Existing notification templates

| Key | Audience | Channels | Trigger |
|---|---|---|---|
| `notification.case.lost.reported` | Owner | Email + SMS + Push | Owner submits a lost document report |
| `notification.case.found.submitted` | Finder | Push only | Finder submits a found document report (pending staff review) |
| `notification.case.found.verified` | Finder | Email + SMS + Push | Staff verifies a found document report |
| `notification.case.found.matched` | Owner | Email + SMS + Push | A found report matches the owner's lost case — must claim or reject |
| `notification.case.lost.matched` | Finder | Email + SMS + Push | The finder's found report is matched to a lost case |
| `notification.case.lost.extraction.complete` | Owner | Email + Push | Background AI extraction finished — owner should review details |
| `notification.case.lost.extraction.failed` | Owner | Email + Push | AI extraction permanently failed — owner must take action |
| `auth.email.verification` | New user | Email only | Sign-up email verification |
| `auth.password.reset` | User | Email only | Password reset request |
| `auth.email.change` | User | Email only | Email change verification |
| `auth.email.change.alert` | User | Email only | Security notice sent to old email on email-change request |

---

## Queue internals

### Three priority queues

| Queue name | Concurrency | Intended use |
|---|---|---|
| `notifications-high` | 10 | OTPs, security alerts, `force: true` sends |
| `notifications-normal` | 5 | Case confirmations, match notifications, reminders |
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

A visual queue dashboard is available at `/api/queues` (requires admin access). It shows pending, active, completed, and failed jobs for all queues.

---

## Notification log

Every send attempt that clears the dispatch pipeline creates a `NotificationLog` row. The status lifecycle is:

```
PENDING → QUEUED → SENT
                 → FAILED   (all retries exhausted)
                 → SKIPPED  (Stage 4 guard: payload could not be resolved — should not happen in normal operation)
```

One log row is created per channel per send. For PUSH, one row is created **per device token** so each device has an independent retry lifecycle.

| Field | Description |
|---|---|
| `channel` | `EMAIL` / `SMS` / `PUSH` |
| `provider` | Which provider actually delivered (e.g. `twilio`, `mailpit`, `expo`) |
| `status` | Current state (see above) |
| `attempts` | How many delivery attempts were made |
| `sentAt` | Timestamp of successful delivery |
| `lastError` | Error message from last failed attempt (capped at 500 chars) |
| `body` | Resolved message body (HTML for email, plain text for SMS/push) |
| `to` | Resolved recipient address / phone number / push token |
| `metadata` | JSON — stores `receiptId` for push (used by Phase-2 receipt check) |
| `userId` | FK to `User` — used for ownership checks in the REST API |
| `recipientId` | Plain string index (same value as `userId` in practice) |

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

`NotificationContentResolver.filterAllowedChannels()` is called at dispatch time (Stage 1) before any log rows or jobs are created. It drops channels based on:

- **User opt-outs** — user has disabled a channel globally in their settings
- **Per-template overrides** — user has overridden a specific template's channel preferences
- **Quiet hours** — current time (in the user's timezone) falls inside the configured window

During quiet hours, **SMS and PUSH are suppressed**; **EMAIL is intentionally allowed** because it is non-intrusive (no sound or vibration). This is by design, not a bug.

Pass `force: true` to bypass all of the above (for OTPs, security alerts, etc.). `force` does not bypass template metadata (Stage 2) or contact-info guards (Stage 3).

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

Overnight quiet-hour ranges work correctly — e.g. `start: 22, end: 8` suppresses SMS/push from 10 pm through 7:59 am.

---

## Push token management

Push tokens are stored in the `UserPushToken` model (table `user_push_tokens`). Tokens are pre-loaded at **dispatch time** (in `enqueue()`), not inside the BullMQ worker, to avoid extra DB round-trips at processing time.

**`PushTokenService`** (`src/push-token/push-token.service.ts`):

```typescript
// Retrieve all active tokens for a user
getPushTokens(userId: string): Promise<string[]>

// Permanently deactivate a token (called automatically on DeviceNotRegistered error)
deactivatePushToken(token: string): Promise<void>
```

When the Expo provider receives a `DeviceNotRegistered` or `InvalidCredentials` error for a token, the processor handler calls `deactivatePushToken()` immediately and prevents future sends to that token — no manual cleanup needed.

**Two-phase Expo delivery** (handled automatically):

1. **Phase 1** — Expo push messages are sent; Expo returns tickets containing a `receiptId`. The `receiptId` is stored in `NotificationLog.metadata`.
2. **Phase 2** (~15 minutes later, automatic) — `NotificationReceiptProcessor` runs and calls `checkReceipts()` to confirm actual device delivery. Permanent errors at this stage also deactivate the token.

---

## Environment variables

### Email (Mailpit / SMTP)

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | `localhost` | SMTP server host |
| `SMTP_PORT` | `1025` | SMTP server port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASSWORD` | — | SMTP password |
| `SMTP_FROM` | `"No Reply" <noreply@example.com>` | Sender address (required in production) |
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
| `EXPO_ACCESS_TOKEN` | Expo push access token (required for production volume) |

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

No other changes needed. The channel service loops over registered providers in order automatically.

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

Add a `WHATSAPP` case in `NotificationContentResolver.resolveFromTemplate()` and `resolveFromInline()` to extract or render the WhatsApp payload from template slots / inline options.

### 6. Wire into the processor handler

```typescript
// notification.processor.handler.ts
case NotificationChannel.WHATSAPP:
  result = await this.whatsappChannel.send(payload as WhatsAppPayload);
  break;
```

### 7. Wire into the dispatch service

Add `NotificationChannel.WHATSAPP` to the `requestedChannels` defaults and add a case in `extractTo()` to pull `recipient.phone` (or a dedicated `whatsapp` field) as the destination address. Also add a contact-info guard in the job-creation loop (same pattern as the EMAIL and SMS guards).

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
3. **Bull Board** (queue dashboard): `/api/queues` (admin access required)
4. To test SMS locally, set `AFRICASTALKING_USERNAME=sandbox` and use the AT sandbox dashboard
5. For push, use the Expo Go app with a real Expo push token registered in the `user_push_tokens` table
6. Use `POST /api/notifications/test` (admin token required) to fire a test notification without writing application code

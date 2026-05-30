# CitizenLink — NestJS Backend

Core API service for the CitizenLink civic platform. Manages lost/found document cases, exchange workflows, custody operations, matching, payments, notifications, and AI extraction.

## Tech Stack

- **Framework**: NestJS 11 (TypeScript)
- **Database**: PostgreSQL 16 via Prisma ORM
- **Queue**: BullMQ + Redis
- **Auth**: Better Auth v1.3 (username, admin, bearer, JWT, 2FA, phoneNumber plugins)
- **Package Manager**: pnpm
- **Validation**: Zod + nestjs-zod
- **AI**: OpenAI-compatible client (Ollama / OpenAI / DeepSeek / Gemini)
- **Storage**: AWS S3 / MinIO
- **Notifications**: Email (SMTP), SMS, Expo Push

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL 16
- Redis

Or use Docker Compose (recommended).

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (creates templates, document types, settings)
pnpm db:seed

# Start development server
pnpm start:dev
```

The API is available at `http://localhost:2000`. Scalar API docs at `http://localhost:2000/api-doc`.

## Docker (Recommended)

```bash
# Start dev environment (PostgreSQL + Redis + Mailpit + app with hot reload)
docker-compose -f docker-compose.dev.yml up

# Run migrations inside the container
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev

# Start production environment
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```

**Service URLs (dev):**
- API: `http://localhost:2000`
- Mailpit UI: `http://localhost:8025`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Commands

```bash
pnpm start:dev          # Dev server with hot reload
pnpm build              # Production build
pnpm start:prod         # Start production build
pnpm test               # Unit tests
pnpm test:e2e           # E2E tests
pnpm lint               # ESLint
pnpm format             # Prettier
pnpm db:seed            # Seed DB (templates, settings, document types)
npx prisma migrate dev  # Create + apply migration
npx prisma studio       # Open Prisma Studio at localhost:5555
pnpm auth:gen           # Regenerate Better Auth types
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | Server port | `2000` |
| `BETTER_AUTH_URL` | Base URL for Better Auth | `http://localhost:2000` |
| `FRONTEND_URL` | Web dashboard URL (used in auth emails) | `http://localhost:8000` |
| `OPENAI_API_KEY` | API key for LLM provider | Required |
| `OPENAI_BASE_URL` | LLM base URL (include `/v1`; omit for OpenAI native) | SDK default |
| `OPENAI_MODEL` | LLM model ID | `deepseek-chat` |
| `CHATBOT_SERVICE_URL` | CitizenLink AI service URL | Required |
| `CHATBOT_SERVICE_INTERNAL_SECRET` | Shared secret with AI service (min 16 chars) | Required |
| `DOCAI_SERVICE_URL` | CitizenLink DocAI service URL | Optional |
| `DOCAI_SERVICE_INTERNAL_SECRET` | Shared secret for DocAI requests | Optional |
| `DOCAI_CALLBACK_SECRET` | Secret validating incoming DocAI webhooks | Optional |
| `AWS_ACCESS_KEY_ID` | S3/MinIO access key | Required |
| `AWS_SECRET_ACCESS_KEY` | S3/MinIO secret key | Required |
| `AWS_S3_BUCKET` | S3 bucket name | Required |
| `AWS_S3_ENDPOINT` | S3 endpoint (MinIO URL for local dev) | AWS default |
| `SMTP_HOST` | SMTP host | Required |
| `SMTP_PORT` | SMTP port | `1025` |
| `SMTP_USER` | SMTP username | Optional |
| `SMTP_PASS` | SMTP password | Optional |
| `SMTP_FROM` | From address | Required |
| `DARAJA_CONSUMER_KEY` | M-Pesa Daraja consumer key | Required |
| `DARAJA_CONSUMER_SECRET` | M-Pesa Daraja consumer secret | Required |
| `DARAJA_PASSKEY` | M-Pesa STK push passkey | Required |
| `DARAJA_SHORTCODE` | M-Pesa shortcode | Required |

### LLM Provider Examples

```bash
# Ollama (local dev)
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
OPENAI_MODEL=llama3.2

# OpenAI
OPENAI_BASE_URL=               # leave unset
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# DeepSeek
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=deepseek-chat

# Gemini
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_API_KEY=AIza...
OPENAI_MODEL=gemini-2.0-flash
```

## Module Overview

See `CLAUDE.md` in the repo root for full architecture documentation.

Key modules: `auth/`, `document-cases/`, `document-exchange/`, `document-custody/`, `matching/`, `extraction/`, `claim/`, `wallet/`, `disbursement/`, `notifications/`, `payment/`, `daraja/`, `roles/`, `stations/`, `region/`, `chat-bot/`, `docai/`

## API

All routes are prefixed with `/api`. Auth routes at `/api/auth/*`.

Interactive API docs (Scalar UI): `http://localhost:2000/api-doc`

## Project Structure

```
src/
├── app.module.ts          # Root module
├── main.ts                # Bootstrap
├── auth/                  # Better Auth configuration and plugins
├── region/                # @Global() regional config (currency, locale, timezone, phone)
├── document-cases/        # Lost/found case management
├── document-exchange/     # Exchange lifecycle, code issuance, courier delivery
├── document-custody/      # Physical custody operations
├── document-types/        # Document type CRUD
├── document-images/       # Case image management
├── matching/              # Multi-strategy matching (vector + text + AI)
├── extraction/            # AI extraction pipeline (BullMQ 3-queue)
├── claim/                 # Claim processing
├── wallet/                # Wallet read + user withdrawals
├── disbursement/          # System B2C disbursements to finders
├── invoice/               # Invoice management
├── payment/               # M-Pesa STK push
├── daraja/                # M-Pesa/Daraja integration
├── mauzo/                 # Payment webhook handler
├── notifications/         # Multi-channel notification system
├── chat-bot/              # AI chatbot proxy
├── docai/                 # Google/custom Document AI webhook handler
├── roles/                 # RBAC — roles, resources, actions
├── stations/              # Pickup station management
├── staff-operation-scope/ # Staff → station operation permission grants
├── station-operation-types/ # Per-station operation type config
├── document-operation-types/ # Global custody operation type registry
├── status-transitions/    # Status transition management
├── address/               # Address management
├── address-hierarchy/     # Administrative hierarchy
├── address-locales/       # Address locale config
├── push-token/            # Expo push token management
├── human-id/              # Human-readable ID generation
├── s3/                    # AWS S3/MinIO integration
├── queue/                 # BullMQ + Bull Board dashboard
├── prompts/               # AI prompt template management
├── common/                # Query builder, settings, templates, PDF
└── prisma/                # Prisma service
```

## Docker Files

- `Dockerfile` — Production multi-stage build
- `Dockerfile.dev` — Development image
- `docker-compose.yml` — Production stack
- `docker-compose.dev.yml` — Dev stack (PostgreSQL + Redis + Mailpit + hot reload)

## Testing

```bash
pnpm test           # Unit tests
pnpm test:cov       # Tests with coverage report
pnpm test:e2e       # End-to-end tests
```

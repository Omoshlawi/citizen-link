#!/bin/sh
set -e

echo "📦 Starting container entrypoint..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set. Exiting."
  exit 1
fi

echo "🔁 Running Prisma migrations against: $DATABASE_URL"

MAX_RETRIES=10
RETRY_COUNT=0

until node_modules/.bin/prisma migrate deploy; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "❌ Prisma migrate deploy failed after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "⚠️ Prisma migrate deploy failed (attempt $RETRY_COUNT/$MAX_RETRIES). Retrying in 5 seconds..."
  sleep 5
done

echo "✅ Prisma migrations applied successfully"

echo "🌱 Running seed scripts..."
# Run seed scripts using ts-node since they are TypeScript
if npx ts-node scripts/seed-address-hierarchy.ts \
  && npx ts-node scripts/seed-admin-user.ts \
  && npx ts-node scripts/seed-address-locales.ts \
  && npx ts-node scripts/seed-pickup-stations.ts \
  && npx ts-node scripts/seed-transition-statuses.ts \
  && npx ts-node scripts/seed-templates.ts \
  && npx ts-node scripts/seed-document-types.ts; then
  echo "✅ Seed scripts completed successfully"
else
  echo "⚠️ Seed scripts failed. Continuing to start the app..."
fi

echo "🚀 Starting NestJS application..."
exec node dist/src/main.js

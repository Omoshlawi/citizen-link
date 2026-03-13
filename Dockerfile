# --- STAGE 1: Build ---
    FROM node:22-alpine AS base

    # Install pnpm and openssl (required for Prisma)
    RUN npm install -g pnpm && apk add --no-cache openssl
    
    WORKDIR /app
    
    # Copy manifest and pnpm-lock (this fixes your current error)
    COPY package.json pnpm-lock.yaml ./
    
    # Install dependencies using pnpm
    RUN pnpm install --frozen-lockfile
    
    # Copy the rest of the application code
    COPY . .
    
    # Generate Prisma client first, then build
    # (The placeholder URL is fine here as it's only for the binary generation)
    ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
    RUN pnpm db generate && pnpm run build
    
    # --- STAGE 2: Runtime ---
    FROM node:22-alpine
    
    # Install openssl in the runtime image too
    RUN apk add --no-cache openssl
    
    WORKDIR /app
    
    # Copy only what is needed for production to keep the image small
    COPY --from=base /app/node_modules ./node_modules
    COPY --from=base /app/dist ./dist
    COPY --from=base /app/prisma ./prisma
    COPY --from=base /app/scripts ./scripts
    COPY --from=base /app/assets ./assets
    COPY --from=base /app/generated ./generated
    COPY --from=base /app/src ./src
    COPY --from=base /app/package.json ./package.json
    COPY --from=base /app/tsconfig.json ./tsconfig.json
    COPY --from=base /app/prisma.config.ts ./prisma.config.ts
    COPY --from=base /app/docker-entrypoint.sh ./docker-entrypoint.sh
    
    # Ensure entrypoint is executable
    RUN chmod +x ./docker-entrypoint.sh
    
    ENV NODE_ENV=production
    
    # Match this with your docker-compose app port (2000)
    EXPOSE 2000
    
    ENTRYPOINT ["./docker-entrypoint.sh"]
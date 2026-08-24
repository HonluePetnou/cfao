FROM node:20-alpine AS builder
WORKDIR /app

# Prisma engines dynamically link against OpenSSL, which the base alpine
# image does not ship — required for `prisma generate`/`db push` to work.
RUN apk add --no-cache openssl

# Copy root workspace files
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci

# packages/config contient tsconfig.base.json dont apps/api/tsconfig.json dépend
COPY packages/ ./packages/

# Fichiers Excel pour les scripts d'import initial
COPY data/ ./data/

# Copy API source and Prisma schema
COPY apps/api ./apps/api

# Generate Prisma Client & Build API
# npm workspaces doesn't always hoist `prisma` to the root node_modules/.bin
# (it can stay nested in apps/api/node_modules/.bin) — bare `npx prisma` run
# from /app then fails with "prisma: not found". `npm exec --workspace=api`
# resolves the binary correctly either way — but it also runs the command
# with apps/api/ as the working directory, so the schema path below is
# relative to apps/api/, not to /app.
RUN npm exec --workspace=api -- prisma generate --schema=prisma/schema.prisma
RUN npm run build --workspace=api

FROM node:20-alpine AS runner
WORKDIR /app

# Same reason as the builder stage: the Prisma query engine needs OpenSSL
# at runtime (used by both `prisma db push` and the Nest app's @prisma/client).
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/data ./data

EXPOSE 4000

CMD ["sh", "-c", "npm exec --workspace=api -- prisma db push --schema=prisma/schema.prisma --accept-data-loss && node apps/api/dist/main.js"]

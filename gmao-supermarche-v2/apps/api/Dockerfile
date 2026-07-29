FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci

# Copy API source and Prisma schema
COPY apps/api ./apps/api

# Generate Prisma Client & Build API
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --schema=apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]

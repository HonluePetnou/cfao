FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package files for workspace
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci

# Copy web source code
COPY apps/web ./apps/web

# Build frontend
ENV NODE_ENV=production
RUN npm run build --workspace=web

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=web"]

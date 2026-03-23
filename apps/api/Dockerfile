FROM node:22-alpine AS base
WORKDIR /app

# ── Install all monorepo dependencies ─────────────────────────────────
FROM base AS deps
# Copy all package.json files + lockfile for the full workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/observability/package.json ./packages/observability/
RUN npm install --workspace=apps/api --workspace=packages/shared --workspace=packages/observability --include-workspace-root --ignore-scripts

# ── Build ─────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# ── Runtime ───────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]

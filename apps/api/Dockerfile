FROM node:22-alpine AS base
WORKDIR /app

# ── Install all monorepo dependencies ─────────────────────────────────
FROM base AS deps
# bcrypt requires native compilation tools on Alpine
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/observability/package.json ./packages/observability/
RUN npm install --workspace=apps/api --workspace=packages/shared --workspace=packages/observability --include-workspace-root

# ── Build ─────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

# Build shared and observability packages to plain JS (CJS)
# so they work with Node.js without tsx for directory imports
RUN cd packages/shared && npx tsc --outDir dist --module commonjs --moduleResolution node --declaration --esModuleInterop --skipLibCheck
RUN cd packages/observability && npx tsc --outDir dist --module commonjs --moduleResolution node --declaration --esModuleInterop --skipLibCheck 2>/dev/null || true

# Point package.json exports to compiled JS output
RUN cd packages/shared && node -e " \
  const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); \
  p.main='./dist/index.js'; p.types='./dist/index.d.ts'; \
  p.exports={'.':'./dist/index.js'}; \
  require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"
RUN cd packages/observability && node -e " \
  const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); \
  p.main='./dist/index.js'; p.types='./dist/index.d.ts'; \
  p.exports={'.':'./dist/index.js'}; \
  require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# ── Runtime ───────────────────────────────────────────────────────────
FROM base AS runner

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]

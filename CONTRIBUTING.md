# Contributing to Surrogate OS

## Dev Environment Setup

1. Clone the repo and install dependencies:

```bash
git clone <repo-url> && cd surrogate-os
npm install
```

2. Create `infra/.env` with your API keys (at minimum `ANTHROPIC_API_KEY`).

3. Start the full stack:

```bash
cd infra && docker compose up -d
```

This starts Postgres (pgvector), the API (Fastify on :3001), the Web dashboard (Next.js on :3000), and the observability stack (Grafana on :4000, Prometheus, Tempo, Loki).

4. The `api-migrate` init container automatically runs `prisma db push` and seeds the database on first boot.

## Running Tests

```bash
# All tests
npm test

# API tests only
cd apps/api && npx vitest run

# Shared package tests only
cd packages/shared && npx vitest run

# Watch mode (API)
cd apps/api && npx vitest
```

## Adding a New Module

Surrogate OS follows a consistent module pattern. To add a new module (e.g., `widgets`):

1. Create the module directory: `apps/api/src/modules/widgets/`
2. Create `widgets.service.ts` -- business logic, database queries via Prisma.
3. Create `widgets.routes.ts` -- Fastify route handlers that call the service.
4. Register routes in `apps/api/src/server.ts`.
5. Add the nav item in the web dashboard layout at `apps/web/src/app/(dashboard)/layout.tsx`.
6. Create the dashboard page at `apps/web/src/app/(dashboard)/widgets/page.tsx`.

## Coding Conventions

- **TypeScript everywhere** -- explicit types, no `any`.
- **SQL / Prisma**: `snake_case` column names (e.g., `created_at`, `org_id`).
- **TypeScript**: `camelCase` for variables and functions, `PascalCase` for types/interfaces.
- **UUID casts**: use `::uuid` in raw SQL queries.
- **Row mappers**: map database rows to typed objects at the service boundary.
- **Error handling**: throw Fastify HTTP errors (`reply.code(4xx).send({ error })`) from routes; services return data or throw.
- **Multi-tenancy**: every query must be scoped to the tenant's `org_id`. The tenant context is injected via `request.tenantDb`.

## PR Process

1. Create a feature branch from `main`.
2. Make your changes, add tests.
3. Open a PR against `main` -- the CI pipeline runs type checking, tests, and a Docker build.
4. Fill out the PR template (type, testing, checklist).
5. Get a review and merge.

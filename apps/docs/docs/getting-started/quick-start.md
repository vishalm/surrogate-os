---
sidebar_position: 2
title: "Quick Start"
description: "Get Surrogate OS running locally in under 5 minutes."
---

# Quick Start

Get Surrogate OS running locally, create your first surrogate, and generate an SOP.

## Prerequisites

- **Docker** and **Docker Compose** (v2+)
- **Node.js** 22+ and **npm** (for local development without Docker)
- **Git**

---

## Option A: Docker Compose (Recommended)

The fastest way to get everything running. This starts PostgreSQL, the API, the web dashboard, and the full observability stack.

### 1. Clone the Repository

```bash
git clone https://github.com/vishalm/surrogate-os.git
cd surrogate-os
```

### 2. Configure Environment

Create an `.env` file in the `infra/` directory with your LLM provider key:

```bash
# infra/.env
ANTHROPIC_API_KEY=sk-ant-...
# Or for OpenAI:
# OPENAI_API_KEY=sk-...
```

### 3. Start Everything

```bash
cd infra
docker compose up -d
```

This will:
- Start PostgreSQL 16 with pgvector
- Run database migrations and seed data
- Start the Fastify API server on port 3001
- Start the Next.js web dashboard on port 3000
- Start the observability stack (Grafana, Prometheus, Tempo, Loki)

### 4. Verify Services

| Service | URL | Purpose |
|---------|-----|---------|
| **Web Dashboard** | [localhost:3000](http://localhost:3000) | Main UI |
| **API Server** | [localhost:3001/health](http://localhost:3001/health) | REST API |
| **Swagger Docs** | [localhost:3001/docs](http://localhost:3001/docs) | API documentation |
| **Grafana** | [localhost:4000](http://localhost:4000) | Observability dashboards |
| **Prometheus** | [localhost:9090](http://localhost:9090) | Metrics |

### 5. Login with Seed Credentials

The seed script creates a default organization and user:

```
Email:    admin@surrogate-os.dev
Password: admin123
```

Open [localhost:3000](http://localhost:3000) and log in, or use the API:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@surrogate-os.dev", "password": "admin123"}'
```

Save the `accessToken` from the response for the next steps.

---

## Option B: Local Development

For active development with hot-reload.

### 1. Clone and Install

```bash
git clone https://github.com/vishalm/surrogate-os.git
cd surrogate-os
npm install
```

### 2. Start Infrastructure

Start only the infrastructure services (PostgreSQL + observability):

```bash
cd infra
docker compose up -d postgres otel-collector tempo loki prometheus grafana
cd ..
```

### 3. Run Migrations

```bash
cd apps/api
npx prisma db push
cd ../..
```

### 4. Start Development Servers

```bash
npm run dev
```

This launches both the API server (port 3001) and the web dashboard (port 3000) via Turborepo with hot-reload.

---

## Your First Surrogate

### Create a Surrogate

```bash
export TOKEN="your_access_token_here"

curl -X POST http://localhost:3001/api/v1/surrogates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "roleTitle": "Senior ER Nurse",
    "domain": "healthcare",
    "jurisdiction": "NHS_UK"
  }'
```

Note the `id` in the response.

### Generate an SOP

Configure your LLM provider first (via Settings in the dashboard or API), then:

```bash
curl -X POST http://localhost:3001/api/v1/llm/generate-sop \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "surrogateId": "YOUR_SURROGATE_ID",
    "additionalContext": "Focus on triage procedures"
  }'
```

### Run an Execution

Start a real-time SOP execution:

```bash
curl -X POST http://localhost:3001/api/v1/executions/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "surrogateId": "YOUR_SURROGATE_ID",
    "sopId": "YOUR_SOP_ID"
  }'
```

Advance through the SOP graph:

```bash
curl -X POST http://localhost:3001/api/v1/executions/YOUR_EXECUTION_ID/advance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "decision": "Proceed to initial assessment",
    "targetNodeId": "NEXT_NODE_ID"
  }'
```

---

## Monorepo Structure

```
surrogate-os/
├── apps/
│   ├── api/            # Fastify backend (port 3001)
│   ├── web/            # Next.js dashboard (port 3000)
│   └── docs/           # Docusaurus documentation (port 3002)
├── packages/
│   ├── shared/         # Zod schemas, types, constants
│   └── observability/  # OpenTelemetry, Pino logging, metrics
├── infra/              # Docker Compose + observability config
└── .github/            # CI/CD workflows
```

---

## Stopping Services

```bash
# Stop everything
cd infra
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v
```

---

## Next Steps

- **[Configuration](/docs/getting-started/configuration)** -- Environment variables and LLM provider setup
- **[Platform Architecture](/docs/architecture/overview)** -- How the system is structured
- **[API Endpoints](/docs/api/endpoints)** -- Complete API reference
- **[Phase 1 Features](/docs/features/phase1-studio)** -- What you can do today

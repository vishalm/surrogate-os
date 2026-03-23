---
sidebar_position: 2
title: "Quick Start"
description: "Get Surrogate OS running locally in under 5 minutes."
---

# Quick Start

Get Surrogate OS running locally and generate your first surrogate.

## Prerequisites

- **Node.js** 18+ and **npm**
- **Docker** and **Docker Compose** (for infrastructure services)
- **Git**

---

## 1. Clone and Install

```bash
git clone https://github.com/surrogate-os/surrogate-os.git
cd surrogate-os
npm install
```

## 2. Start Infrastructure

Spin up PostgreSQL, OpenTelemetry Collector, Grafana, Prometheus, Loki, and Tempo:

```bash
cd infra
docker-compose up -d
cd ..
```

**Services available at:**

| Service | URL | Purpose |
|---------|-----|---------|
| PostgreSQL | `localhost:5432` | Primary database |
| Grafana | `localhost:4000` | Observability dashboards |
| Prometheus | `localhost:9090` | Metrics |
| Tempo | `localhost:3200` | Distributed traces |
| Loki | `localhost:3100` | Log aggregation |
| OTEL Collector | `localhost:4318` | Telemetry ingestion |

## 3. Run Database Migrations

```bash
cd apps/api
npx prisma migrate dev
cd ../..
```

## 4. Start Development Servers

```bash
npm run dev
```

This launches both the **API server** (`localhost:3001`) and the **web dashboard** (`localhost:3000`) via Turborepo.

## 5. Generate Your First Surrogate

### Via the API

```bash
curl -X POST http://localhost:3001/v1/surrogates/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your_token}" \
  -d '{
    "role": "Senior ER Nurse",
    "jurisdiction": "NHS_UK",
    "organization": {
      "name": "Royal London Hospital",
      "type": "NHS Trust"
    }
  }'
```

```json
{
  "surrogateId": "sg_f8a2b1c9",
  "status": "ready",
  "sopCount": 147,
  "complianceScore": 99.8,
  "deploymentToken": "dt_..."
}
```

### Via the CLI (Coming Soon)

```bash
npx surrogate generate \
  --role "Senior ER Nurse" \
  --org "City General Hospital" \
  --jurisdiction "NHS_UK" \
  --output ./my-nurse-surrogate
```

## 6. Query Your Surrogate

```bash
curl -X POST http://localhost:3001/v1/surrogates/sg_f8a2b1c9/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your_token}" \
  -d '{"message": "Patient: chest pain, diaphoresis, SOB. ESI score?"}'
```

---

## Monorepo Structure

```
surrogate-os/
├── apps/
│   ├── api/          # Fastify backend (port 3001)
│   ├── web/          # Next.js dashboard (port 3000)
│   └── docs/         # This documentation (port 3002)
├── packages/
│   ├── shared/       # Types, schemas, constants
│   └── observability/# Logging, tracing, metrics
├── infra/            # Docker Compose + observability config
└── docs/             # Source documentation
```

---

## Next Steps

- **[Configuration](/docs/getting-started/configuration)** — Environment variables and safety settings
- **[Architecture](/docs/technical/architecture)** — How the system works under the hood
- **[API Reference](/docs/technical/api-reference)** — Full API documentation

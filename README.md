<p align="center">
  <img src="apps/docs/static/img/logo.svg" alt="Surrogate OS" width="80" height="80" />
</p>

<h1 align="center">Surrogate OS</h1>

<p align="center">
  <strong>The AI Identity Engine That Becomes the Employee</strong>
</p>

<p align="center">
  <a href="https://vishalm.github.io/surrogate-os/">Documentation</a> &bull;
  <a href="https://vishalm.github.io/surrogate-os/docs/getting-started/quick-start">Quick Start</a> &bull;
  <a href="https://vishalm.github.io/surrogate-os/docs/architecture/overview">Architecture</a> &bull;
  <a href="https://vishalm.github.io/surrogate-os/docs/api/endpoints">API Reference</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-22-green?logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/Tests-571_passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/Docker-8_containers-blue?logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-BSL_1.1-orange" alt="License" />
</p>

---

Surrogate OS synthesizes complete professional identities and deploys them as operational AI agents across chat, voice, avatar, and humanoid interfaces. It doesn't just answer questions  it *becomes* the employee.

## Key Features

| Feature | Description |
|---------|-------------|
| **Surrogate Studio** | Create and manage AI professional identities with persona configuration |
| **SOP Engine** | LLM-generated decision graphs (9 node types) with versioning and certification |
| **Surrogate Chat** | Real-time conversational interface  talk to your surrogates directly |
| **Execution Engine** | Live SOP traversal with decision recording and escalation handling |
| **Fleet Management** | Monitor all surrogates in real-time with health metrics and handoff protocols |
| **Institutional Memory** | Short-term and long-term memory with pattern detection and promotion |
| **Org DNA Ingestion** | Embed organizational knowledge via pgvector for RAG |
| **Shift Debriefs** | LLM-powered session analysis with improvement recommendations |
| **SOP Self-Update** | Automatic SOP improvement proposals from debrief insights |
| **Persona Library** | Versioned templates with rollback, import/export, and instantiation |
| **SOP Marketplace** | Publish, discover, and install SOPs across organizations |
| **Bias Audit** | LLM-powered anomaly detection and fairness analysis |
| **Compliance Engine** | 6 regulatory frameworks (HIPAA, GDPR, CQC, FCA, SOX, EU AI Act) with Ed25519 SOP signing |
| **Humanoid SDK** | Interface abstraction from chat to fully autonomous with kill-switch controls |
| **Federated Learning** | Cross-org insights with differential privacy (Laplacian noise, gradient clipping) |
| **Analytics** | Time-series metrics, decision heatmaps, domain breakdowns, CSV export |
| **Data Portability** | Full org export/import (one of 5 founding commitments) |

## Architecture

```
surrogate-os/
  apps/
    api/          # Fastify API (25 route modules, ~130 endpoints)
    web/          # Next.js 14 Dashboard (47 pages, 20 nav items)
    docs/         # Docusaurus documentation site
  packages/
    shared/       # Types, schemas, constants (Zod validation)
    observability/# OpenTelemetry tracing, metrics, structured logging
  infra/          # Docker Compose (8 containers)
```

**Stack:** TypeScript, Fastify, Next.js 14, Prisma, PostgreSQL 16, pgvector, OpenTelemetry, Grafana, Prometheus, Loki, Tempo

**Multi-tenancy:** Schema-per-tenant isolation with 25+ tenant tables per org.

**Loosely coupled:** Event bus (15 event types), service registry (DI), unified LLM provider (4 providers: Anthropic, OpenAI, Azure, Ollama).

## Quick Start

### Prerequisites

- Docker Desktop
- Node.js 22+

### Run with Docker Compose

```bash
# Clone
git clone https://github.com/vishalm/surrogate-os.git
cd surrogate-os

# Start everything (8 containers)
cd infra
cp .env.example .env  # Add your ANTHROPIC_API_KEY
docker compose up -d --build

# Seed the database
docker compose exec api npx tsx prisma/seed.ts
```

**Services:**

| Service | URL |
|---------|-----|
| Web Dashboard | http://localhost:3000 |
| API Server | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |
| Grafana | http://localhost:4000 (admin/admin) |
| Prometheus | http://localhost:9090 |

**Login:** `admin@acme.com` / `Password123!`

### Local Development

```bash
# Install dependencies
npm install

# Build shared packages
cd packages/shared && npx tsc && cd ../..
cd packages/observability && npx tsc && cd ../..

# Start infrastructure
cd infra && docker compose up -d postgres loki tempo prometheus grafana otel-collector

# Run API (dev mode)
cd apps/api && npm run dev

# Run Web (dev mode)
cd apps/web && npm run dev
```

## Testing

```bash
# Run all API tests (341 tests)
cd apps/api && npx vitest run

# Run shared tests (230 tests)
cd packages/shared && npx vitest run

# Watch mode
cd apps/api && npx vitest
```

**571 tests** across 20 test files covering: crypto, pagination, errors, graph validation, graph diff, SOP executor, SOP signing, differential privacy, task translator, event bus, service registry, compliance frameworks, humanoid interfaces, webhooks, audit helpers, and all Zod schemas.

## API Overview

25 route modules under `/api/v1`:

| Module | Endpoints | Description |
|--------|-----------|-------------|
| `/auth` | 4 | Login, register, refresh, invite |
| `/orgs` | 4 | Org CRUD + settings |
| `/surrogates` | 5 | Surrogate lifecycle |
| `/sops` | 5 | SOP versioning + status transitions |
| `/llm` | 1 | LLM-powered SOP generation |
| `/chat` | 5 | Surrogate conversations |
| `/executions` | 10 | Live SOP execution |
| `/debriefs` | 9 | Sessions + debrief generation |
| `/proposals` | 5 | SOP improvement proposals |
| `/fleet` | 5 | Fleet monitoring |
| `/handoffs` | 5 | Surrogate handoff protocol |
| `/personas` | 9 | Persona templates |
| `/marketplace` | 8 | SOP marketplace |
| `/memory` | 7 | Institutional memory |
| `/org-dna` | 5 | Document embeddings |
| `/bias` | 6 | Bias auditing |
| `/compliance` | 8 | Regulatory compliance |
| `/humanoid` | 7 | Device management |
| `/federation` | 7 | Federated learning |
| `/analytics` | 8 | Reporting + export |
| `/activity` | 3 | Activity feed + search |
| `/export` | 6 | Data portability |
| `/api-keys` | 4 | API key management |
| `/webhooks` | 6 | Webhook management |
| `/notifications` | 4 | In-app notifications |

## Documentation

Full documentation is available at **[vishalm.github.io/surrogate-os](https://vishalm.github.io/surrogate-os/)**:

- [Quick Start Guide](https://vishalm.github.io/surrogate-os/docs/getting-started/quick-start)
- [Architecture Overview](https://vishalm.github.io/surrogate-os/docs/architecture/overview)
- [Multi-Tenancy Deep Dive](https://vishalm.github.io/surrogate-os/docs/architecture/multi-tenancy)
- [API Endpoints Reference](https://vishalm.github.io/surrogate-os/docs/api/endpoints)
- [Phase 1: Surrogate Studio](https://vishalm.github.io/surrogate-os/docs/features/phase1-studio)
- [Phase 2: Living Persona](https://vishalm.github.io/surrogate-os/docs/features/phase2-persona)
- [Phase 3: Fleet Intelligence](https://vishalm.github.io/surrogate-os/docs/features/phase3-fleet)
- [Phase 4: Humanoid Bridge](https://vishalm.github.io/surrogate-os/docs/features/phase4-bridge)

## Five Founding Commitments

1. **Open SOP Standard**  Portable, interoperable decision graph format
2. **Data Portability**  Full org export/import, never locked in
3. **Bias Transparency**  LLM-powered auditing with anomaly detection
4. **Human-in-the-Loop**  Kill switches, escalation nodes, checkpoint approvals
5. **Privacy by Design**  Schema-per-tenant isolation, differential privacy in federation

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and PR guidelines.

## License

Business Source License 1.1 (BSL-1.1). See [LICENSE](LICENSE) for details.

---

<p align="center">
  <em>"The workforce is a right, not a privilege."</em>
</p>

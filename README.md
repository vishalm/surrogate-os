<p align="center">
  <img src="apps/docs/static/img/logo.svg" alt="Surrogate OS" width="100" height="100" />
</p>

<h1 align="center">Surrogate OS</h1>

<h3 align="center">The AI Identity Engine</h3>

<p align="center">
  <strong>Synthesize complete AI employees from a role description.<br/>Deploy across chat, voice, AR, and humanoid interfaces.</strong>
</p>

<p align="center">
  <a href="https://github.com/vishalm/surrogate-os/actions"><img src="https://img.shields.io/github/actions/workflow/status/vishalm/surrogate-os/ci.yml?branch=main&label=build&logo=github" alt="Build Status" /></a>
  <img src="https://img.shields.io/badge/tests-571_passing-brightgreen?logo=vitest" alt="Tests" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript" alt="TypeScript" />
  <a href="https://github.com/vishalm/surrogate-os/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License MIT" /></a>
  <img src="https://img.shields.io/badge/docker-8_services-blue?logo=docker" alt="Docker" />
  <a href="https://github.com/vishalm/surrogate-os/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" /></a>
</p>

<p align="center">
  <a href="https://vishalm.github.io/surrogate-os/">Docs</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="https://vishalm.github.io/surrogate-os/docs/api/endpoints">API Reference</a> &middot;
  <a href="ROADMAP.md">Roadmap</a>
</p>

---

## What is Surrogate OS?

Surrogate OS is a platform that creates professional AI surrogates — digital employees with domain expertise, regulatory compliance, and institutional memory. Define a role (Senior ER Nurse, M&A Legal Advisor), and the system generates decision-making SOPs, enforces compliance across six frameworks (HIPAA, GDPR, EU AI Act), and learns from every interaction. Think of it as an operating system for AI workers that actually *become* the employee.

---

## Key Features

### Identity & Expertise

- **Surrogate Studio** — Create AI professional identities from a role description
- **Persona Templates** — Versioned persona library with rollback, import/export
- **SOP Generation** — LLM-powered decision graphs (9 node types) with certification

### Intelligence

- **Institutional Memory** — Short-term and long-term memory with pattern promotion
- **Shift Debriefs** — Automated session analysis with improvement recommendations
- **SOP Self-Update** — Automatic improvement proposals from debrief insights
- **Org DNA** — Embed organizational knowledge via pgvector for RAG retrieval

### Compliance & Safety

- **6 Regulatory Frameworks** — HIPAA, GDPR, CQC, FCA, SOX, EU AI Act
- **Ed25519 SOP Signing** — Cryptographic certification of decision procedures
- **Bias Auditing** — LLM-powered anomaly detection and fairness analysis
- **Human-in-the-Loop** — Kill switches, escalation nodes, checkpoint approvals

### Operations

- **Fleet Management** — Monitor all surrogates in real-time with health metrics
- **Handoff Protocol** — Seamless surrogate-to-surrogate and surrogate-to-human transfers
- **Execution Engine** — Live SOP traversal with decision recording

### Enterprise

- **Multi-Tenant** — Schema-per-tenant isolation with 25+ tables per org
- **API Keys & Webhooks** — Programmatic access and event-driven integrations
- **Federated Learning** — Cross-org insights with differential privacy
- **Data Portability** — Full org export/import, zero lock-in

### Interface

- **Surrogate Chat** — Real-time conversations with your AI employees
- **Humanoid SDK** — Interface abstraction from chat to fully autonomous
- **SOP Marketplace** — Publish, discover, and install SOPs across organizations

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Interface Layer               │
│    Chat · Voice · AR · Humanoid         │
├─────────────────────────────────────────┤
│          Execution Layer                │
│   SOP Engine · Session · Decisions      │
├─────────────────────────────────────────┤
│          Intelligence Layer             │
│  Memory · Debriefs · Proposals · DNA    │
├─────────────────────────────────────────┤
│           Identity Layer                │
│  Surrogates · Personas · SOPs · Certs   │
├─────────────────────────────────────────┤
│         Infrastructure Layer            │
│ Multi-Tenant · OTEL · Prisma · pgvector │
└─────────────────────────────────────────┘
```

**Loosely coupled** — Event bus (15 event types), service registry (DI), unified LLM provider across 4 providers.

---

## Quick Start

Get running in under 2 minutes:

```bash
git clone https://github.com/vishalm/surrogate-os.git
cd surrogate-os/infra
docker compose up -d
```

| Service | URL |
|---------|-----|
| Web Dashboard | [localhost:3000](http://localhost:3000) |
| API Server | [localhost:3001](http://localhost:3001) |
| Swagger Docs | [localhost:3001/docs](http://localhost:3001/docs) |
| Grafana | [localhost:4000](http://localhost:4000) |

**Login:** `admin@acme.com` / `Password123!`

> Set your `ANTHROPIC_API_KEY` in `infra/.env` to enable LLM features. See the [Quick Start Guide](https://vishalm.github.io/surrogate-os/docs/getting-started/quick-start) for details.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React, Tailwind CSS |
| Backend | Fastify, Node.js 22 |
| Database | PostgreSQL 16, Prisma ORM, pgvector |
| Observability | OpenTelemetry, Grafana, Prometheus, Loki, Tempo |
| Infrastructure | Docker Compose (8 containers) |
| Language | TypeScript (strict mode) |

---

## Platform Stats

| Metric | Count |
|--------|-------|
| API Modules | 25 |
| API Endpoints | ~130 |
| Dashboard Pages | 47 |
| Tests Passing | 571 |
| Docker Services | 8 |
| Compliance Frameworks | 6 |
| LLM Providers | 4 |

---

## LLM Providers

Surrogate OS supports multiple LLM backends, configurable per-organization:

| Provider | Type |
|----------|------|
| **Anthropic Claude** | Cloud |
| **OpenAI** | Cloud |
| **Azure OpenAI** | Cloud |
| **Ollama** | Local / Self-hosted |

Switch providers in **Settings > LLM Configuration** without changing any surrogate definitions.

---

## Documentation

Full documentation is available at **[vishalm.github.io/surrogate-os](https://vishalm.github.io/surrogate-os/)**

- [Quick Start Guide](https://vishalm.github.io/surrogate-os/docs/getting-started/quick-start)
- [Architecture Overview](https://vishalm.github.io/surrogate-os/docs/architecture/overview)
- [Multi-Tenancy Deep Dive](https://vishalm.github.io/surrogate-os/docs/architecture/multi-tenancy)
- [API Endpoints Reference](https://vishalm.github.io/surrogate-os/docs/api/endpoints)
- [Feature Phases](https://vishalm.github.io/surrogate-os/docs/features/phase1-studio)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and PR guidelines.

Looking for a place to start? Check out issues labeled [`good first issue`](https://github.com/vishalm/surrogate-os/labels/good%20first%20issue).

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and the development timeline.

---

## License

[MIT](LICENSE)

---

<p align="center">
  <a href="https://star-history.com/#vishalm/surrogate-os&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=vishalm/surrogate-os&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=vishalm/surrogate-os&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=vishalm/surrogate-os&type=Date" width="600" />
    </picture>
  </a>
</p>

<p align="center">
  If you find Surrogate OS useful, consider giving it a <a href="https://github.com/vishalm/surrogate-os">star</a>.
</p>

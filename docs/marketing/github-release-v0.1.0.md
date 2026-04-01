# v0.1.0 — The AI Identity Engine

Surrogate OS is a platform that synthesizes complete AI employees from role descriptions, deploying them across chat, voice, AR, and humanoid interfaces with built-in regulatory compliance.

## Highlights

### Identity & Expertise
- Create surrogates with persona configuration (seniority, risk tolerance, communication style)
- AI-generated Standard Operating Procedures (SOPs) with 9 decision node types
- Persona template library with versioning and rollback
- SOP Marketplace for sharing and installing procedures

### Intelligence
- Institutional memory with Short-Term (STM) and Long-Term (LTM) memory
- Shift debrief engine with LLM-powered analysis
- SOP self-improvement through debrief-driven proposals
- Org DNA ingestion with pgvector embeddings for RAG

### Compliance & Trust
- 6 regulatory frameworks: CQC, HIPAA, FCA, SOX, GDPR, EU AI Act
- Ed25519 cryptographic SOP signing with chain of custody
- Bias audit dashboard with LLM-powered anomaly detection
- Tamper-proof audit log with SHA-256 hash chaining

### Operations
- Fleet management dashboard with real-time surrogate status
- Handoff protocol (Device-to-Device, Device-to-Human, Human-to-Device)
- Real-time SOP execution engine with live graph traversal
- Analytics engine with time-series metrics and decision heatmaps

### Enterprise
- Multi-tenant architecture (schema-per-tenant isolation)
- 4 LLM providers: Anthropic Claude, OpenAI, Azure OpenAI, Ollama
- API keys with HMAC-SHA256 webhook signing
- Full observability: OpenTelemetry, Grafana, Prometheus, Loki, Tempo

### Platform
- Conversational chat interface with surrogates
- Global search (command palette) across all entities
- Activity timeline with audit enrichment
- Full org data import/export for portability
- Federated learning v1 with differential privacy

## By the Numbers
- 25 API modules, ~130 REST endpoints
- 47 frontend pages, 20 navigation items
- 571 tests (341 API + 230 shared), all passing
- 8 Docker services, single `docker compose up`
- 3 CI/CD workflows (CI, Release, Docs Deploy)
- TypeScript end-to-end (Next.js 15 + Fastify + Prisma)

## Quick Start
```bash
git clone https://github.com/vishalm/surrogate-os.git
cd surrogate-os/infra
docker compose up -d
# Web: http://localhost:3000 | API: http://localhost:3001
# Login: admin@acme.com / Password123!
```

## What's Next
See [ROADMAP.md](https://github.com/vishalm/surrogate-os/blob/main/ROADMAP.md) for the v0.2.0 plan.

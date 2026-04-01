# Show HN: Surrogate OS -- Synthesize AI employees from a role description

**Link:** https://github.com/vishalm/surrogate-os
**Docs:** https://vishalm.github.io/surrogate-os/

Surrogate OS takes a role description -- Senior ER Nurse, M&A Legal Advisor, whatever -- and generates a complete AI employee: domain expertise, decision-making SOPs, regulatory compliance, and institutional memory.

**What makes it different from chatbots:**

- **Versioned identities.** Each surrogate has a signed, auditable identity that evolves over time. Not a stateless prompt.
- **9-node SOP decision graphs.** Every decision follows an explicit graph (INFORMATION_GATHER -> ASSESSMENT -> DECISION -> ACTION -> ESCALATION...). No black-box reasoning.
- **Self-improvement.** After interactions, surrogates run debriefs, propose SOP modifications, and update their own decision graphs (with human approval).
- **Memory.** Short-term memory promotes to long-term via relevance scoring. Surrogates actually learn from experience.
- **Multi-interface deployment.** Same surrogate identity across chat, voice, AR, or humanoid robotics interfaces.

**Compliance is built in, not bolted on:**

6 frameworks: HIPAA, GDPR, EU AI Act, CQC, FCA, SOX. SOP signing with Ed25519 (chain of custody, tamper detection). Bias auditing. Federated learning with differential privacy.

**Tech stack:**

TypeScript monorepo (Turborepo). Fastify API, Next.js dashboard, PostgreSQL + pgvector for RAG, Redis, OpenTelemetry observability. 571 tests, 130+ API endpoints, 8 Docker services.

**Open source, MIT licensed.**

Looking for feedback on:
- The SOP engine architecture (graph generation, validation, execution)
- Our compliance approach (is it practical for real deployments?)
- The self-improvement loop (debrief -> proposal -> approval -> new SOP version)

Happy to answer questions about design decisions. We wrote extensive docs covering architecture, compliance, and the decision graph system.

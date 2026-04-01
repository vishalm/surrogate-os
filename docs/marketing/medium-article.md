# I Built an Open-Source Platform That Creates AI Employees From Job Descriptions

*Originally published on [Surrogate OS Blog](https://vishalm.github.io/surrogate-os/blog/introducing-surrogate-os)*

---

Today I am open-sourcing **Surrogate OS**, an AI identity engine that transforms job descriptions into fully operational AI professionals — complete with structured personas, standard operating procedures, regulatory compliance, and institutional memory. It is available now on [GitHub](https://github.com/vishalm/surrogate-os) under the MIT license.

This is not another chatbot framework. Surrogate OS produces AI surrogates that carry professional identities, follow auditable decision-making procedures, comply with real-world regulations, and learn from their own operational history. Think of it as the operating system layer between foundation models and the actual work that regulated industries need AI to perform.

## The Problem Nobody Wants to Talk About

The AI agent landscape in 2026 is simultaneously thrilling and deeply broken.

On one side, foundation models have reached a level of capability that makes autonomous task completion genuinely viable. Every week brings a new framework promising to turn GPT or Claude into an agent that can handle customer support, triage medical records, process insurance claims, or manage financial portfolios.

On the other side, the industries that would benefit most from AI agents — healthcare, finance, legal, government — are the ones that cannot deploy them. The reason is not technical capability. The reason is trust, governance, and regulatory compliance.

Consider the state of affairs. A hospital system evaluating an AI triage assistant faces HIPAA requirements that demand a complete audit trail of every clinical decision. A European bank deploying an AI financial advisor must satisfy both GDPR data handling requirements and the incoming EU AI Act obligations for high-risk AI systems. A law firm exploring AI paralegals needs to demonstrate that the system follows established procedures and does not introduce bias into case assessments.

None of the mainstream agent frameworks address these requirements as first-class concerns. Compliance is treated as something to bolt on later — a Phase 2 problem. But anyone who has worked in regulated industries knows that compliance cannot be Phase 2. If the foundation is not auditable, no amount of wrapper code will make a regulator comfortable.

I built Surrogate OS to close that gap.

## What Surrogate OS Actually Does

The core premise is deceptively simple: you define a role, and Surrogate OS synthesizes a complete AI professional to fill it.

But "define a role" means something very specific here. A surrogate is not a prompt template with a personality description stapled on. It is a structured professional identity composed of several interconnected layers:

**Identity and Persona** — Every surrogate has a defined professional background, communication style, areas of expertise, and behavioral boundaries. The persona layer constrains the surrogate's behavior in measurable ways, ensuring it operates within its defined scope of practice.

**Standard Operating Procedures (SOPs)** — This is the core of what makes a surrogate different from a chatbot. Each surrogate comes with a directed acyclic graph of operational procedures. These are structured decision trees with defined inputs, outputs, validation criteria, escalation triggers, and compliance checkpoints.

**Regulatory Compliance** — Every SOP node is tagged with applicable regulatory frameworks. The system enforces compliance at the procedure level, not as an afterthought.

**Institutional Memory** — Surrogates maintain both short-term and long-term memory, with mechanisms for promoting operational learnings into persistent institutional knowledge.

**Interface Adaptability** — The same surrogate identity can be deployed across text chat, voice, avatar, and eventually humanoid robotic interfaces without redefining its core logic.

### A Concrete Example: The Senior ER Nurse

To make this tangible, walk through what happens when you create a Senior ER Nurse surrogate.

You start with a role definition that specifies the clinical scope: emergency triage, patient assessment, care coordination, medication verification. The system synthesizes a professional identity with appropriate clinical communication patterns and establishes boundaries — this surrogate will escalate to a physician for diagnostic decisions and will not prescribe medications.

The SOP engine then generates a 9-node procedure graph for the triage workflow. Each node — from patient intake through acuity assessment, allergy checks, clinical routing, care coordination, documentation, follow-up scheduling, shift debrief, and SOP improvement proposals — has defined inputs, outputs, and validation criteria. Every transition is logged. Every compliance-relevant action generates an audit trail entry with a cryptographic signature.

This is not a theoretical architecture. It is implemented, tested, and running.

## The Compliance Foundation

I made an early decision that shaped everything about Surrogate OS: compliance is not a feature. It is the foundation.

The platform currently supports six regulatory frameworks: **HIPAA**, **GDPR**, **EU AI Act**, **SOC 2**, **FDA SaMD**, and **FINRA**.

### Cryptographic SOP Signing

Every standard operating procedure is cryptographically signed using Ed25519 signatures. When an SOP is created or modified, the system generates a signature that covers the complete procedure definition — every node, every transition, every validation criterion.

This creates an immutable chain of custody. If a regulator asks "what procedure was this AI following when it made that decision at 3:47 AM on Tuesday?", I can provide the exact SOP version, prove it has not been tampered with, and show the complete decision trace through that procedure.

The signing infrastructure uses hash chaining, where each SOP revision includes the hash of the previous version. This produces a tamper-evident history of every procedural change, who authorized it, and when it took effect.

### Bias Auditing

The compliance layer includes a bias detection system that monitors surrogate behavior across demographic dimensions. The system tracks decision distributions and flags statistical anomalies that might indicate bias in triage priority, response quality, escalation frequency, or any other measurable operational dimension.

For high-risk AI systems under the EU AI Act, bias monitoring is a legal requirement. I built it in from day one.

### Why Open Source Matters for Compliance

There is a philosophical reason I chose to open-source Surrogate OS. In regulated industries, trust requires transparency. When a hospital deploys an AI triage system, the compliance team needs to be able to audit not just the decisions the system makes, but the code that governs how it makes them.

Open source is not just a distribution model for Surrogate OS. It is a compliance strategy.

## Surrogates That Learn

A static set of procedures is useful but limited. Real professionals learn from experience. I built an intelligence layer designed to give surrogates the same capability — with appropriate guardrails.

### Institutional Memory

Every surrogate maintains two tiers of memory. **Short-Term Memory** captures the immediate operational context — the current interaction, recent decisions, active tasks. **Long-Term Memory** stores persistent institutional knowledge — patterns observed across many interactions, procedural learnings, domain-specific insights.

The system includes a promotion mechanism that identifies high-value short-term observations and elevates them to long-term storage after validation. Memory promotion is not automatic — the system proposes promotions, and a human operator reviews and approves.

### Shift Debriefs and Self-Improvement

At the end of each operational period, a surrogate generates a structured self-assessment. The LLM analyzes its own performance, identifying low-confidence decisions, escalation patterns, gaps in SOP coverage, and potential procedure improvements.

When accumulated operational data suggests a procedure modification, the system generates a specific, testable proposal. No SOP modification takes effect without human approval. The system proposes; humans decide.

### Federated Learning With Differential Privacy

For organizations running multiple surrogates across different facilities, Surrogate OS supports federated learning with differential privacy guarantees. A hospital network running ER triage surrogates at twelve locations can aggregate learnings about triage patterns without any individual patient data leaving its home facility.

## One Identity, Many Interfaces

The same Senior ER Nurse surrogate — with the same persona, SOPs, compliance layer, and institutional memory — can be deployed as a text-based chat interface, a voice interface for phone triage, an avatar for telemedicine, or eventually a physical presence through humanoid robotic systems.

The interface layer handles modality-specific concerns. The decision-making logic, compliance enforcement, and professional identity remain constant across all interfaces.

### Fleet Management and Human Handoff

Real-world deployments involve many surrogates. Surrogate OS includes fleet management for monitoring, updating, and coordinating multiple surrogates, plus a structured handoff protocol for transferring operational context from a surrogate to a human professional with minimal information loss.

## Technical Foundation

Surrogate OS is not a prototype. It is a production-grade platform:

- **571 tests** spanning unit, integration, and end-to-end scenarios
- **130+ REST endpoints** covering the complete surrogate lifecycle
- **TypeScript monorepo** using Turborepo for build orchestration
- **Docker Compose** deployment for single-command setup
- **Multi-tenant architecture** with tenant isolation at database, API, and surrogate levels
- **Full observability stack** with structured logging, distributed tracing, and metrics

## What Comes Next

The near-term roadmap includes production hardening, additional regulatory frameworks, a voice interface reference implementation, partner integrations for major EHR and financial platforms, and compliance certification support tooling.

I am particularly interested in collaborators from regulated industries — healthcare systems, financial institutions, legal organizations — who can provide domain expertise and real-world validation.

## Get Involved

- **GitHub**: [github.com/vishalm/surrogate-os](https://github.com/vishalm/surrogate-os)
- **Documentation**: [vishalm.github.io/surrogate-os](https://vishalm.github.io/surrogate-os)
- **Contact**: hello@surrogate-os.com

The workforce of the future will be a blend of human and AI professionals. Surrogate OS exists to make sure the AI half of that equation is built on a foundation worthy of the trust it will be given.

---

### Suggested Medium Tags
- Artificial Intelligence
- Open Source
- Healthcare Technology
- Compliance
- Software Engineering

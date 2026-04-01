---
title: "Building an AI Identity Engine: 571 Tests, 6 Compliance Frameworks, and Why I Open-Sourced It"
subtitle: "A deep dive into the architecture of Surrogate OS — the platform that turns job descriptions into deployable, compliant AI professionals"
slug: building-ai-identity-engine-surrogate-os
cover_image: https://vishalm.github.io/surrogate-os/img/surrogate-os-og.png
tags: ai, opensource, typescript, compliance, healthtech, fintech
canonical_url: https://vishalm.github.io/surrogate-os/blog/introducing-surrogate-os
---

Today I am open-sourcing **Surrogate OS**, an AI identity engine that transforms job descriptions into fully operational AI professionals. It is available now on [GitHub](https://github.com/vishalm/surrogate-os) under the MIT license.

I want to share the engineering decisions behind it, because I think the AI agent ecosystem has a compliance problem that nobody is seriously addressing — and the solution required some architectural choices that other developers building in regulated spaces might find useful.

## The Problem: AI Agents Have a Compliance Gap

Every AI agent framework in 2026 assumes a friendly deployment environment. Build an agent, give it tools, point it at a task. Works great for internal productivity tools and developer workflows.

Now try deploying that same pattern in a hospital. Or a bank. Or a law firm.

These industries need AI agents — arguably more than anyone. But they operate under regulatory frameworks that demand complete auditability, data governance, bias monitoring, and human oversight. None of the popular agent frameworks treat these requirements as first-class concerns.

I built Surrogate OS to close that gap. Not by adding compliance as a layer on top of an existing agent framework, but by designing the entire architecture around regulatory requirements from the start.

## Architecture Overview

Surrogate OS is a TypeScript monorepo built with Turborepo. The core abstraction is a **surrogate** — a structured AI professional identity composed of:

1. **Persona** — Professional identity, communication style, scope of practice
2. **SOP Graph** — A directed acyclic graph of standard operating procedures
3. **Compliance Layer** — Per-node regulatory framework enforcement
4. **Memory System** — Short-term and long-term institutional memory
5. **Interface Adapter** — Deploy the same identity across chat, voice, avatar, or humanoid

Let me walk through the parts that were most interesting to build.

## The SOP Engine

The Standard Operating Procedure engine is the heart of the system. Unlike most agent frameworks that use flat prompt chains or simple tool-calling loops, Surrogate OS models professional workflows as directed acyclic graphs.

Each node in the graph has:

```typescript
interface SOPNode {
  id: string;
  name: string;
  description: string;
  inputs: ValidationSchema;
  outputs: ValidationSchema;
  complianceFrameworks: ComplianceFramework[];
  escalationTriggers: EscalationRule[];
  validationCriteria: ValidationCriterion[];
  nextNodes: ConditionalTransition[];
}
```

The `complianceFrameworks` field is what makes this different. Every node declares which regulatory requirements apply to it. The runtime engine calls the compliance service at each transition to verify that the operation satisfies all applicable frameworks before proceeding.

For a Senior ER Nurse surrogate, the triage SOP is a 9-node graph:

```
Patient Intake → Acuity Assessment → Allergy Check → Clinical Routing
     ↓                                                      ↓
Documentation ← Care Coordination ← Treatment Pathway ← Priority Queue
     ↓
Shift Debrief → SOP Improvement Proposal
```

Each node has typed inputs and outputs. The Allergy Check node, for example, requires patient ID and medication list as inputs, produces a cleared/flagged status as output, and triggers an immediate escalation if a critical allergy is detected. The node is tagged with HIPAA compliance requirements, so every access to the patient's allergy data generates an audit trail entry.

## Cryptographic SOP Signing With Ed25519

This is the piece I am most proud of architecturally. Every SOP in the system is cryptographically signed.

When an SOP is created or modified, the system:

1. Serializes the complete SOP graph to canonical JSON (deterministic serialization — same content always produces same bytes)
2. Signs the serialized content with Ed25519
3. Stores the signature alongside the SOP definition

```typescript
import { sign, verify } from '@noble/ed25519';

async function signSOP(sop: SOPDefinition, privateKey: Uint8Array): Promise<SOPSignature> {
  const canonical = canonicalize(sop);
  const encoded = new TextEncoder().encode(canonical);
  const signature = await sign(encoded, privateKey);

  return {
    sopId: sop.id,
    version: sop.version,
    signature: Buffer.from(signature).toString('hex'),
    previousVersionHash: sop.previousVersion
      ? await hashSOP(sop.previousVersion)
      : null,
    signedAt: new Date().toISOString(),
    signedBy: sop.authorizedBy,
  };
}
```

The `previousVersionHash` field creates a hash chain. Each SOP revision includes the hash of the previous version, creating a tamper-evident revision history. If any intermediate version is modified or deleted, the chain breaks.

Why Ed25519 specifically? Fast signature generation (important when SOPs are verified at runtime), compact 64-byte signatures, deterministic output for testability, and strong resistance to side-channel attacks.

Why does this matter? When a regulator asks "what procedure was this AI following when it made that decision?", you can provide the exact SOP version with cryptographic proof of integrity. You can prove the complete revision history. You can show who authorized each change and when.

## Compliance as a Service, Not Middleware

I evaluated three architectural approaches for the compliance layer:

**Middleware** — Compliance checks in the HTTP pipeline. Rejected because any code path that bypasses the middleware bypasses compliance.

**Embedded** — Compliance logic inside the SOP engine. Rejected because it couples operational logic with compliance logic, making both harder to change.

**Independent service** — Compliance as a separate service with a well-defined API. Selected.

```typescript
interface ComplianceService {
  // Called at each SOP node transition
  evaluate(context: ComplianceContext): Promise<ComplianceDecision>;

  // Query audit trail
  queryAuditTrail(filters: AuditFilters): Promise<AuditEntry[]>;

  // Bias monitoring
  getBiasReport(surrogateId: string, timeRange: TimeRange): Promise<BiasReport>;

  // Framework-specific compliance status
  getComplianceStatus(frameworks: ComplianceFramework[]): Promise<ComplianceStatus>;
}
```

The SOP engine calls `evaluate()` at each node transition. The compliance service checks the operation against all applicable frameworks and returns allow/deny/flag. The service maintains its own data store for framework definitions, audit records, and bias monitoring data.

This separation means I can add new compliance frameworks without touching the SOP engine, test compliance logic in isolation, and update compliance rules independently of operational logic.

## The Memory System

Every surrogate maintains two tiers of memory:

**Short-Term Memory (STM)** — Operational context for the current session. Think of it as working memory during a shift.

**Long-Term Memory (LTM)** — Persistent institutional knowledge accumulated across many interactions.

The interesting part is the promotion mechanism:

```typescript
interface MemoryPromotionCandidate {
  observation: string;
  frequency: number;        // How often this pattern appeared
  impact: ImpactScore;      // Measured effect on outcomes
  novelty: NoveltyScore;    // How different from existing LTM
  proposedAt: Date;
  status: 'proposed' | 'approved' | 'rejected';
  reviewedBy?: string;      // Human reviewer ID
}
```

The system identifies high-value observations in STM — patterns that recur frequently, have measurable impact on outcomes, and are not already captured in LTM. These are proposed for promotion. A human reviews and approves before anything becomes part of the surrogate's permanent knowledge.

This human-in-the-loop design is not just good practice — it is a requirement under the EU AI Act's human oversight provisions for high-risk AI systems.

## Bias Detection

The bias detection system monitors surrogate behavior across demographic dimensions using three approaches:

1. **Distribution monitoring** — Running statistical distributions of decisions segmented by demographic variables, flagging significant deviations
2. **Comparative analysis** — Comparing behavior across surrogates performing similar roles, controlling for case mix
3. **Counterfactual testing** — Generating identical scenarios with only demographic variables modified, checking for divergent outcomes

```typescript
interface BiasAlert {
  surrogateId: string;
  dimension: DemographicDimension;
  metric: OperationalMetric;
  deviation: StatisticalDeviation;
  timePeriod: TimeRange;
  evidence: BiasEvidence;
  recommendedActions: string[];
}
```

Alerts are routed to compliance officers. The system never automatically modifies surrogate behavior — bias remediation decisions remain with humans.

## Federated Learning With Differential Privacy

For multi-facility deployments, surrogates can share operational learnings without sharing raw data:

1. Compute learning updates locally at each facility
2. Add calibrated Gaussian noise (differential privacy)
3. Send only noised aggregates to the central coordinator
4. Combine updates and distribute back

The privacy budget (epsilon) is configurable per deployment and per regulatory framework. This provides mathematical guarantees about individual data protection while allowing surrogates to benefit from collective experience.

## The Numbers

After months of building:

- **571 tests** — Unit, integration, and end-to-end. Not just happy paths — failure modes, edge cases, and compliance-specific validation scenarios.
- **130+ REST endpoints** — Complete surrogate lifecycle management, SOP operations, compliance reporting, memory management, fleet coordination.
- **6 compliance frameworks** — HIPAA, GDPR, EU AI Act, SOC 2, FDA SaMD, FINRA.
- **Multi-tenant architecture** — Tenant isolation at database, API, and surrogate levels.
- **Docker Compose deployment** — Single-command setup. Important for healthcare orgs with on-premises requirements.
- **Full observability** — Structured logging, distributed tracing, metrics. Every surrogate decision is traceable end to end.

## Why Open Source

In regulated industries, trust requires transparency. When a hospital deploys an AI triage system, the compliance team needs to audit not just the decisions, but the code. Black-box systems face an inherently harder path to regulatory approval.

Open source is a compliance strategy, not just a distribution model.

## Get Involved

Surrogate OS is available now:

- **GitHub**: [github.com/vishalm/surrogate-os](https://github.com/vishalm/surrogate-os)
- **Docs**: [vishalm.github.io/surrogate-os](https://vishalm.github.io/surrogate-os)
- **Blog**: [vishalm.github.io/surrogate-os/blog](https://vishalm.github.io/surrogate-os/blog)

I am especially interested in contributors with domain expertise in healthcare, financial services, or legal technology. The hardest problems ahead are not engineering problems — they are domain modeling problems that require deep industry knowledge.

If you are building AI systems for regulated industries, I would love to hear what compliance challenges you face. Open an issue, send a PR, or reach out at hello@surrogate-os.com.

---

*Suggested Hashnode Tags: #ai #opensource #typescript #compliance #healthtech*

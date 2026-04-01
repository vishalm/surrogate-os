---
title: Building HIPAA + GDPR + EU AI Act Compliance into an LLM System
published: false
description: Deploying AI in healthcare or finance without compliance is a lawsuit waiting to happen. Here's how we built 6 compliance frameworks into Surrogate OS.
tags: ai, compliance, security, typescript
cover_image:
---

## The Compliance Problem No One Wants to Solve

Everyone's excited about deploying LLM-powered agents. Few are thinking about what happens when those agents handle protected health information, financial data, or make decisions that fall under the EU AI Act.

Here's the reality: if you deploy an AI agent in a hospital and it mishandles patient data, you're looking at HIPAA fines up to $1.5M per violation. If your AI makes biased decisions in the EU without proper documentation, the AI Act penalties reach 7% of global revenue.

We built Surrogate OS -- an open-source platform that synthesizes AI employees from role descriptions. Compliance isn't a feature we added later. It's the foundation.

## The 6 Frameworks

Surrogate OS supports six compliance frameworks out of the box:

| Framework | Domain | Key Requirements |
|-----------|--------|------------------|
| **HIPAA** | US Healthcare | PHI protection, audit trails, access controls, breach notification |
| **GDPR** | EU Data Privacy | Consent management, right to erasure, data minimization, DPO |
| **EU AI Act** | EU AI Regulation | Risk classification, transparency, human oversight, bias monitoring |
| **CQC** | UK Healthcare Quality | Care standards, safety protocols, evidence-based practice |
| **FCA** | UK Financial Conduct | Consumer protection, market integrity, fair treatment |
| **SOX** | US Financial Reporting | Internal controls, audit trails, data integrity |

Each surrogate is tagged with applicable frameworks based on its role. A healthcare surrogate gets HIPAA + CQC. A financial advisor gets FCA + SOX. The compliance engine enforces the right rules automatically.

## Architecture: Compliance as a Service

Compliance checks aren't scattered throughout the codebase. They're centralized:

```
Request -> API Gateway -> Compliance Middleware -> Business Logic
                              |
                              v
                    Compliance Engine
                    ├── Framework Registry
                    ├── Rule Evaluator
                    ├── Audit Logger
                    └── Violation Handler
```

Every API request that touches surrogate data passes through compliance middleware. The middleware:

1. Identifies which frameworks apply to the current surrogate
2. Evaluates the request against framework-specific rules
3. Logs the compliance check to the immutable audit trail
4. Blocks or flags requests that violate rules

This means developers building on top of the platform don't need to think about compliance. The middleware handles it.

## SOP Signing with Ed25519

Every Standard Operating Procedure (the decision graph that defines how a surrogate operates) is cryptographically signed:

```typescript
interface SignedSOP {
  sopId: string;
  version: number;
  content: SOPGraph;
  signature: string;        // Ed25519 signature
  publicKey: string;        // Signer's public key
  signedAt: string;         // ISO timestamp
  previousVersion?: string; // Hash of previous version
}
```

Why Ed25519? It's fast, has small signatures (64 bytes), and is widely trusted. Every SOP version links to the previous one via hash, creating an immutable chain of custody.

This means you can prove:
- **Who** approved a particular SOP version
- **When** it was approved
- **What** changed from the previous version
- That the SOP **has not been tampered with** since signing

For HIPAA and SOX audits, this chain of custody is essential.

## Bias Auditing

The EU AI Act requires bias monitoring for high-risk AI systems. We built LLM-powered bias analysis directly into the platform:

```typescript
interface BiasAuditResult {
  surrogateId: string;
  auditTimestamp: string;
  categories: BiasCategory[];
  overallRiskScore: number;  // 0-1
  recommendations: string[];
  evidenceSamples: AuditEvidence[];
}

type BiasCategory =
  | 'demographic'
  | 'socioeconomic'
  | 'geographic'
  | 'linguistic'
  | 'cultural';
```

The bias auditor periodically samples a surrogate's interactions and analyzes them for:
- Demographic bias in decision-making
- Socioeconomic assumptions
- Geographic or linguistic favoritism
- Cultural insensitivity

Results feed into the compliance dashboard. High-risk scores trigger alerts and can pause a surrogate pending review.

## Federated Learning with Differential Privacy

Surrogates learn from interactions, but that learning can't leak sensitive data. We use federated learning with differential privacy:

1. **Local training:** Each tenant's surrogates learn from their own interactions
2. **Gradient clipping:** Limits the influence of any single data point
3. **Laplacian noise injection:** Adds calibrated noise to gradients before aggregation
4. **Federated aggregation:** Learning is shared across the fleet without sharing raw data

```typescript
interface DifferentialPrivacyConfig {
  epsilon: number;           // Privacy budget
  delta: number;             // Failure probability
  noiseType: 'laplacian';
  clippingThreshold: number; // Max gradient norm
  compositionMethod: 'advanced'; // Tight composition bounds
}
```

The epsilon parameter controls the privacy-utility tradeoff. Lower epsilon = more privacy, less learning. We default to conservative values and let operators tune based on their risk tolerance.

This approach satisfies GDPR's data minimization principle and HIPAA's minimum necessary standard -- the system learns from patterns without ever accessing or transmitting raw protected data.

## Immutable Audit Trails

Every action in the system is recorded in a hash-chained audit log:

```
Entry N:
  action: "sop_execution"
  actor: "surrogate:nurse-er-001"
  context: { nodeId: "assess-vitals", decision: "escalate" }
  hash: SHA-256(Entry N data + Entry N-1 hash)
  timestamp: "2024-01-15T14:30:00Z"
```

The hash chain means you can't modify or delete audit entries without breaking the chain. Auditors can verify the entire history is intact by recomputing hashes.

For HIPAA, this satisfies the audit trail requirement. For SOX, this provides the internal controls documentation. For the EU AI Act, this delivers the transparency and traceability obligations.

## Why Open Source Compliance Matters

Compliance in proprietary systems is a black box. You trust the vendor's claims. Open source compliance means:

- **Auditors can read the code.** No "trust us, it's compliant."
- **Security researchers can find vulnerabilities.** Before bad actors do.
- **Regulated organizations can verify** the implementation matches the documentation.
- **The community improves it.** More eyes on compliance code = fewer gaps.

## Try It

Surrogate OS is MIT licensed. The compliance engine is one piece of a larger system: SOP decision graphs, multi-tenant isolation, memory systems, fleet management, and multi-interface deployment.

GitHub: [github.com/vishalm/surrogate-os](https://github.com/vishalm/surrogate-os)
Docs: [vishalm.github.io/surrogate-os](https://vishalm.github.io/surrogate-os/)

571 tests covering compliance paths. If you're building AI for regulated industries, I'd love to compare approaches.

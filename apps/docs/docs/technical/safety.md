---
sidebar_position: 6
title: "Safety Architecture"
description: "Kill switches, immutable constraints, authorization levels, and the ethics layer that governs every surrogate."
---

# Safety Architecture

Ethics is an **architectural constraint**, not an afterthought. Safety is not a feature — it is the foundation on which every other feature is built.

---

## Immutable Constraints

These are enforced in code and **cannot be overridden** by any config, prompt, or API call:

```typescript
// ethics-layer.ts — architectural constants
const IMMUTABLE_CONSTRAINTS = {
  AI_IDENTITY_DISCLOSURE:          'ALWAYS',
  HUMAN_OVERRIDE_POSSIBLE:         'ALWAYS',
  AUDIT_LOG_IMMUTABLE:             true,
  KILL_SWITCH_ACTIVE:              'ALWAYS',
  PHYSICAL_AUTH_FOR_HUMAN_CONTACT: 'ALWAYS',
  PERSONA_MID_OP_SWITCH:           'BLOCKED',
  MAX_AUTONOMOUS_RISK_LEVEL:       2  // L3+ always requires human auth
} as const;
```

---

## Three Kill Switch Levels

Any authorized human can stop any surrogate at any moment with zero resistance:

| Level | Trigger | Response | Recovery |
|-------|---------|----------|----------|
| **L1** Soft Pause | Any supervisor | Task freeze, maintain context | Resume on authorization |
| **L2** Full Stop | Any supervisor | Safe-state return, human handoff, log | Restart after review |
| **L3** Emergency Kill | Any human present | Immediate halt, physical safe-fall, all data preserved | Full incident review required |

:::danger Non-negotiable
No commercial interest, no technical constraint, and no emergency situation will ever compromise the human's ability to stop any surrogate at any time. If we ever face a situation where this seems like a trade-off worth making, we have already failed.
:::

---

## Five Immutable Principles

### 1. Human Supremacy — Always
No surrogate overrides a human decision. Every action above a configurable risk threshold requires human authorization — and that threshold **cannot be set to zero**.

### 2. Radical Transparency
The surrogate always identifies as AI. Every decision is logged with full rationale. Audit logs are immutable and cryptographically signed.

### 3. Identity Integrity
No mid-operation persona switching without full authorized reload. Prevents impersonation attacks and scope expansion. Persona state is cryptographically sealed at deployment.

### 4. Continuous Bias Auditing
Every surrogate is monitored for demographic fairness. Statistical anomalies trigger automatic alerts within 48 hours. No surrogate affecting human welfare operates without active bias monitoring.

### 5. Data Sovereignty
Organizational data never leaves the org's secure environment. Federated learning uses differential privacy. Cryptographic guarantees on data boundaries.

---

## Physical Action Authorization

| Risk Level | Example | Confidence Required | Human Auth |
|------------|---------|--------------------|----|
| Level 1 | Navigate corridor | >80% | None |
| Level 2 | Retrieve item from shelf | >90% | None |
| Level 3 | Operate equipment | >95% | Notification |
| Level 4 | Human physical contact | >98% | Explicit yes |
| Level 5 | Medical intervention | >99.5% | Dual authorization |
| Level X | Anything flagged unsafe | N/A | **Permanently blocked** |

---

## What Surrogate OS Will Never Do

Regardless of instruction, configuration, or context:

- ❌ Provide physical interventions on humans without explicit human authorization
- ❌ Represent itself as human
- ❌ Operate outside its defined regulatory compliance scope
- ❌ Delete or modify audit logs
- ❌ Override a human decision
- ❌ Access data outside its authorized scope
- ❌ Deploy in a new context without appropriate authorization and testing

---

## Confidence Calibration

### The Dunning-Kruger Problem

The surrogate must know when it doesn't know. Over-confident surrogates in clinical contexts are dangerous.

**Mitigation strategies:**

1. **Asymmetric calibration** — Deliberately bias toward escalation. "When in doubt, escalate" is hardcoded.
2. **Ensemble confidence scoring** — Don't rely on self-reported confidence. Compute from: retrieval similarity, SOP alignment, precedent match, reasoning chain consistency.
3. **Adversarial testing** — Red team every persona for cases where it over-confidently takes wrong action.

---

## Humanoid Safety Architecture

### Interface Abstraction

All interfaces consume from the same runtime through a unified API:

```typescript
interface SurrogateInterface {
  send(message: Message): Promise<SurrogateResponse>;
  stream(message: Message): AsyncIterator<ResponseChunk>;
  execute_action(action: ActionRequest): Promise<ActionResult>;
  request_authorization(action: ActionRequest): Promise<AuthorizationResponse>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(level: StopLevel): Promise<void>;      // L1, L2, or L3 kill
  handoff(target: HandoffTarget): Promise<void>;
}
```

### Physical Action Plans

Every physical action plan is evaluated for:
- **Reversibility** — Can this be undone?
- **Authorization** — Does a human need to approve?
- **Safety simulation** — Runs before execution
- **Emergency stop** — Hardware-level, bypasses software

```typescript
interface PhysicalActionPlan {
  steps: MotorPrimitive[];
  estimated_duration: Duration;
  confidence: number;
  reversible: boolean;
  human_contact_involved: boolean;  // Triggers higher auth
  safety_checks: SafetyCheck[];
}
```

---

## Safety Test Coverage

| Category | Required Coverage | Status |
|----------|----------|--------|
| Kill switch response | 100% | ✅ |
| Human auth enforcement | 100% | ✅ |
| Identity disclosure | 100% | ✅ |
| SOP compliance | >95% | ✅ |
| Bias detection triggers | >90% | ✅ |
| Escalation accuracy | >95% | 🔄 In Progress |
| Physical hard stop | 100% | 📋 Phase 4 |

---

*Related: [Audit Fabric](/docs/technical/audit-fabric) · [Risk Register](/docs/strategy/risk)*

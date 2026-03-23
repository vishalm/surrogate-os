---
sidebar_position: 4
title: "Risk Register"
description: "Honest assessment of every meaningful risk — product, market, execution, and ethical — with specific mitigation strategies."
---

# Risk Register

> *"Founders who don't map their risks in advance don't avoid them. They just encounter them unprepared."*

---

## Risk Summary

| Risk | Probability | Severity | Mitigation |
|------|------------|----------|------------|
| SOP hallucination | Medium | **Critical** | Expert validation gate |
| Institutional memory breach | Low | **Critical** | Architecture isolation, BYOK |
| Confidence overstatement | Medium | High | Asymmetric calibration |
| Slow regulated adoption | **High** | Medium | UAE fast-track + NHS Innovation |
| Well-funded competitor | Medium | High | Corpus moat, execute fast |
| Incumbent product launch | High (5yr) | Medium | Certify first, partner |
| Hiring velocity | Medium | Medium | Mission-brand, advisor network |
| Public deployment failure | Low | **Critical** | Scoped pilots, governance-first |
| Access concentration | **High** | Mission | Structural commitment |
| Humanoid harm at scale | Low (now) | **Critical** | Auth architecture, staged deployment |

---

## Product Risks

### SOP Hallucination in High-Stakes Contexts

The SOP pipeline produces a plausible but incorrect procedure. A clinical decision is made based on it. A patient is harmed.

**Mitigation:**
1. **Expert validation gate is non-negotiable.** No SOP deploys without domain expert sign-off. Day one.
2. **SOPs are generated for review**, not direct deployment. Draft → human expert review → approval → deploy.
3. **Aggressive escalation thresholds.** Below 95% confidence → escalate. Always.
4. **Scope limiting.** Initial deployments: documentation and monitoring ONLY. Not clinical decisions.

### Institutional Memory Breach

Cross-org data leak through namespace isolation bug, misconfiguration, or supply chain compromise.

**Mitigation:**
1. **Architecture-level isolation.** Own encryption key, own vector DB namespace, own processing environment per org.
2. **BYOK default.** Surrogate OS cannot decrypt institutional memory even if compelled.
3. **Regular pen testing** before any regulated deployment goes live.

### Confidence Overstatement

The surrogate consistently reports high confidence where it should be uncertain.

**Mitigation:**
1. **Asymmetric calibration.** Bias toward escalation. Cost of unnecessary escalation ≪ cost of confident error.
2. **Ensemble confidence scoring.** Multiple signals: retrieval similarity, SOP alignment, precedent match, reasoning consistency.
3. **Adversarial testing** before every persona deployment.

---

## Market Risks

### Slow Regulated Adoption

NHS procurement takes 18 months. Year 1 ARR is 20% of projection.

**Mitigation:**
1. **UAE as fast-follower.** Innovation-forward, faster to close, creates international credibility.
2. **NHS Innovation pathways.** AI Lab, AHSN network — bypass standard procurement.
3. **Runway for the slow case.** Financial model solvent at 18-month sales cycles.
4. **Studio tier as revenue bridge.** $299/month accounts close quickly.

### Well-Funded Competitor

A16Z funds a team with the same concept and more capital.

**Mitigation:**
1. **Corpus moat activates faster than they can catch up** if we start now. 18-month gap is not catchable.
2. **Regulatory relationships are equally time-dependent.** First to shape the framework wins.
3. **Niche depth beats generalist breadth** in regulated market adoption.

---

## Execution Risks

### Public Deployment Failure

First NHS pilot generates a high-profile error. Brand takes years to recover.

**Mitigation:**
1. **Design the pilot to be failure-safe.** Scope: documentation/monitoring only. Every output reviewed for 30 days.
2. **Governance pace sets deployment pace.** Never let champions push faster than governance approves.
3. **Communication plan ready before the incident.** Pre-agreed incident response from day one.

---

## Ethical Risks

### Access Concentration

Business realities push toward large enterprise contracts. The village clinic in Bihar never sees the platform.

**Mitigation:**
1. **Access pricing as a structural commitment.** Written into governing documents. Cannot be reversed without governance board approval.
2. **Base SOPs are a public good.** WHO Essential Health Package roles freely available.
3. **Annual impact reporting** with third-party audit.

### Humanoid Harm at Scale

Systematic failure across multiple humanoid deployments.

**Mitigation:**
1. **Non-negotiable authorization architecture.** >98% confidence + explicit human auth + safety simulation for any human contact.
2. **Scale slowly, certify at each level.** 1 → 5 → 20 → 100 per setting, with safety review at each stage.
3. **Design for the failure mode.** Every physical action plan evaluated for: "what happens if this goes wrong halfway through?"

---

## The Risk Conclusion

Every risk is real. None is fatal if addressed proactively. The pattern across all mitigations:

:::tip Governance before speed
Build the governance first. Build the audit trail first. Build the kill switch first. Build the expert validation network first. **Then** build the product on top of that foundation.
:::

It is slower. It is more expensive upfront. It is the only way this works in the contexts that matter.

---

*Next: [Why Build This →](/docs/strategy/why-build)*

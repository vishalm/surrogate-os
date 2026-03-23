# RISK.md
## The Honest Risk Register — Everything That Could Go Wrong and Why We Build Anyway

---

> *"Founders who don't map their risks in advance don't avoid them.
>  They just encounter them unprepared."*

---

## Preface: Why Write This Document

Most pitch decks have a slide labeled "Risks" that says things like "regulatory uncertainty"
and "market adoption" — five words that convey nothing and reveal nothing.

This document is the opposite. It is a serious, specific, honest assessment of every
meaningful risk this platform faces — with a precise description of what could go wrong,
an honest assessment of the probability and severity, and a mitigation strategy that
actually engages with the risk.

The purpose is not to talk you out of building. It is to ensure that if you build,
you build with your eyes open — and with the mitigation strategies already in place
before the risk materializes.

---

## Risk Category 1: Product Risks

### Risk 1.1 — SOP Hallucination in High-Stakes Contexts

**What could go wrong:**
The SOP generation pipeline produces a procedural SOP that sounds clinically plausible
but contains an error — a wrong drug interaction threshold, an incorrect escalation
trigger, a missed step in a critical procedure. The SOP is deployed, a clinical
decision is made based on it, and a patient is harmed.

**Probability:** Medium (without mitigation). Hallucination in complex procedural
generation is a known failure mode of current LLMs.

**Severity:** Critical. A patient harm event in a clinical deployment would:
- Trigger immediate regulatory action
- Destroy trust in the platform across the entire healthcare vertical
- Generate legal liability
- Potentially end the company

**Mitigation:**

1. **The expert validation gate is non-negotiable.** No SOP ever deploys without sign-off
   from a qualified domain expert. This is not a feature to be added later — it is the
   foundational quality control mechanism from day one.

2. **SOPs are generated for review, not for direct deployment.** The mental model is:
   the SOP generator produces a high-quality draft. A human expert treats it as they
   would a junior colleague's work — reviews it, corrects it, approves it.

3. **Confidence-calibrated action thresholds.** The surrogate operates below its SOP
   confidence level for any clinical action. Anything below 95% confidence → escalate.
   Aggressive escalation is better than confident error.

4. **Scope limiting.** In initial deployments, surrogates are scoped to
   documentation, monitoring, and information tasks — NOT clinical decision-making.
   The transition to advisory and then to action-supporting happens only with
   accumulated evidence and explicit governance approval at each stage.

---

### Risk 1.2 — Institutional Memory Breach

**What could go wrong:**
The institutional memory system for one organization leaks to another — either through
a bug in namespace isolation, a misconfiguration in the vector DB, or a supply chain
compromise. Organization A's patient-related interaction patterns become accessible
to Organization B.

**Probability:** Low (with proper architecture). High (if architecture is rushed).

**Severity:** Critical. A healthcare data breach violates HIPAA, UK GDPR, and NHS DSP
simultaneously. Regulatory fines + reputational destruction.

**Mitigation:**

1. **Architecture-level isolation.** Each organization has its own encryption key,
   its own vector DB namespace, and its own data processing environment.
   Cross-org access is impossible by architecture, not just by policy.

2. **Encryption key ownership.** The organization holds their own encryption key.
   Surrogate OS cannot decrypt their institutional memory even if compelled.
   BYOK (Bring Your Own Key) is the default, not the premium option.

3. **Regular penetration testing.** External security audit of isolation mechanisms
   before any regulated deployment goes live.

---

### Risk 1.3 — Confidence Overstatement (The Dunning-Kruger Problem)

**What could go wrong:**
The surrogate consistently reports high confidence on decisions where it should be
uncertain — not because the model is arrogant, but because confidence calibration
in LLMs is a known hard problem. A surrogate that should escalate instead acts,
because it incorrectly believes it is certain.

**Probability:** Medium. Confidence calibration is an active research area with
known challenges in current-generation models.

**Severity:** High. Especially in clinical and legal contexts where acting with
misplaced confidence is worse than not acting.

**Mitigation:**

1. **Asymmetric calibration.** Deliberately bias the calibration toward escalation.
   "When in doubt, escalate" is the hardcoded principle. The cost of unnecessary
   escalation (human reviews something the surrogate could have handled) is far
   lower than the cost of unwarranted confidence (the surrogate acts incorrectly).

2. **Ensemble confidence scoring.** Don't rely on the model's self-reported confidence.
   Compute confidence from multiple signals: retrieval similarity scores, SOP alignment
   metrics, precedent match rate, and reasoning chain consistency. Escalate if any
   signal is below threshold.

3. **Adversarial testing before deployment.** Every new surrogate persona goes through
   a structured adversarial evaluation — red team specifically looking for cases
   where it over-confidently takes a wrong action.

---

## Risk Category 2: Market Risks

### Risk 2.1 — Regulated Industry Adoption Takes Longer Than Projected

**What could go wrong:**
The 90-day sales cycle assumption is wrong. NHS procurement takes 18 months.
Legal firm partnership committees are slow. Finance firms' model risk governance
requires 2 years of track record. Year 1 ARR is 20% of projection because the
buying process in target verticals moves much slower than modeled.

**Probability:** High. This is actually likely in at least one target vertical.
Healthcare procurement is notoriously slow.

**Severity:** Medium. Painful financially, but not fatal if the runway is sufficient.

**Mitigation:**

1. **UAE as the fast-follower market.** Dubai, Abu Dhabi, and Singapore have
   more innovation-forward regulatory environments for healthcare AI. They are
   simultaneously prestigious reference customers and faster to close.
   Build UAE pilots in parallel with NHS engagement — they close faster and
   create international credibility.

2. **NHS Innovation pathway exploitation.** NHS England has specific fast-track
   routes for AI pilots: NHS AI Lab, AHSN network, Digital Health Hub.
   These bypass standard procurement and can compress timelines to 60–90 days.

3. **Runway design for the slow case.** The financial model must be solvent
   assuming 18-month sales cycles, not 90-day ones. If the fast case materializes,
   it's upside. The slow case cannot be fatal.

4. **SMB Studio tier as revenue bridge.** $299/month accounts that close quickly
   provide revenue while enterprise deals progress slowly. They also provide
   deployment data that strengthens the enterprise case study.

---

### Risk 2.2 — A Well-Funded Competitor Enters With the Same Concept

**What could go wrong:**
A16Z or Sequoia funds a team building essentially the same thing, with more capital,
a stronger technical team, and the ability to give away the product for 2 years to
capture the market. They out-deploy you, capture the regulatory relationships,
and build the corpus faster.

**Probability:** Medium. The concept is discoverable. The window is visible to anyone
watching the AI and robotics markets.

**Severity:** High. A well-capitalized competitor with the same insight is a serious threat.

**Mitigation:**

1. **The corpus moat activates faster than they can catch up if you start now.**
   A competitor starting 18 months after you begins the corpus accumulation 18 months
   behind you. In regulated industry deployment, that is not catchable quickly.

2. **The regulatory relationship moat is equally time-dependent.**
   The first company to sit in a room with NHS AI Lab governance teams and shape
   the framework has an advantage that no amount of capital can replicate in the
   second year.

3. **The differentiation is execution, not idea.** The insight that expertise should
   be portable is not rare. The ability to execute in regulated environments —
   building the governance, the compliance architecture, the trust relationships,
   the expert validation network — is extremely rare. Execute faster than they can.

4. **Niche specificity as defense.** Own one vertical completely before expanding.
   A generalist competitor who launches across all verticals simultaneously
   will be worse than you in each specific vertical. Depth beats breadth in
   regulated market adoption.

---

### Risk 2.3 — Large Incumbents Launch a Competing Product

**What could go wrong:**
Epic launches "Epic AI Surrogate." Salesforce Health Cloud adds a "Clinical AI Agent"
feature. Microsoft Copilot for Healthcare adds SOP generation. These incumbents already
have the distribution, the data relationships, and the trust. They compete not with a
better product but with a "good enough" product bundled into something customers
already pay for.

**Probability:** High over a 5-year horizon. Incumbents will eventually move here.

**Severity:** Medium for the long term. Manageable if moats are built before they move.

**Mitigation:**

1. **Be certified before they are.** Epic can build a feature. Epic cannot get
   clinical governance certification in 6 months. If we have NHS-certified SOP stacks
   and they don't, the feature doesn't displace us — it validates the category.

2. **Depth of persona vs. breadth of feature.** An EHR vendor adding a "SOP generator"
   will build a horizontal feature. Our clinical surrogate is a vertical product with
   12 months of domain expert investment per persona. "Good enough" features don't
   displace deep domain products in regulated contexts.

3. **Partner before they compete.** The better outcome is Epic integrating Surrogate OS
   as their AI agent layer rather than building their own. This requires having
   a strong enough product that partnership is more attractive than replication.
   That window exists for approximately 24 months. Use it.

---

## Risk Category 3: Execution Risks

### Risk 3.1 — Team Can't Hire Fast Enough

**What could go wrong:**
The core technical capabilities — LLM application architecture, regulated industry
compliance engineering, domain expert network — are expensive and scarce.
The team stays at 4–6 people too long, slowing product development to a crawl
while better-funded competitors move faster.

**Probability:** Medium. AI engineering talent is competitive.

**Severity:** Medium. Slows execution, doesn't stop it.

**Mitigation:**

1. **The mission attracts the mission-aligned.** Engineers who want to build something
   genuinely significant — not another ChatGPT wrapper — exist and are looking.
   The vision document, the moral case, and the genuine importance of the problem
   are hiring tools. Use them.

2. **Domain expert advisory network as force multiplier.** You don't need to hire
   a senior NHS clinical governance expert full-time. You need them on retainer,
   reviewing SOPs and providing sign-off. A network of 20 domain expert advisors
   (paid in equity and day rates) replaces the need to hire 20 full-time domain experts.

3. **Stage the hiring to the revenue.** Year 1: core 6–8 person team focused on
   clinical vertical. Hire generalists who can flex across roles. Year 2: revenue
   funds specialization. Don't hire ahead of the money — hire at the money.

---

### Risk 3.2 — First Major Deployment Fails Publicly

**What could go wrong:**
The first NHS pilot deploys, generates a high-profile error — a drug interaction
missed, a wrong escalation, a data privacy incident — and the story becomes
"AI surrogate fails in hospital." Every other target customer cancels their
interest. The brand takes a reputational hit that takes years to recover.

**Probability:** Low (with proper risk architecture). Not negligible.

**Severity:** Critical.

**Mitigation:**

1. **Design the first pilot to be failure-safe.**
   - Scope: documentation and monitoring ONLY in first pilot. No clinical decisions.
   - Supervision: every output reviewed by a senior clinical team member for 30 days
   - Escalation: any uncertainty → human review. Aggressive escalation threshold.
   - Exit: clear protocol for suspending deployment immediately if any concern arises

2. **Never let the pilot go faster than the governance.**
   The biggest risk is a well-meaning clinical champion who pushes to expand the
   surrogate's scope faster than the governance committee has approved.
   The governance pace sets the deployment pace. Always.

3. **Have the communication plan ready before the incident, not after.**
   Every deployment has a pre-agreed incident response plan: who is notified,
   what is communicated, how the surrogate is paused, and what the investigation
   process looks like. This plan exists on day one of deployment, not after something
   goes wrong.

---

## Risk Category 4: Ethical and Societal Risks

### Risk 4.1 — The Platform Concentrates Benefits, Not Distributes Them

**What could go wrong:**
Despite the stated mission of access for all, the business realities push pricing
toward large enterprise contracts with well-resourced institutions. The platform
becomes a sophisticated tool for wealthy healthcare systems to become more efficient —
while the rural clinic in Bihar, the village school in Kenya, and the small NGO
in earthquake-affected Turkey never see it.

**Probability:** High WITHOUT deliberate structural commitment.

**Severity:** Existential to the mission (not the business, but the mission).

**Mitigation:**

1. **Access pricing as a structural commitment, not a CSR program.**
   Specific pricing tiers for: (a) governments of low-income countries, (b) NGOs
   and humanitarian organizations, (c) public health systems in LMICs.
   These tiers are written into the company's governing documents, not just
   stated in a blog post. They cannot be reversed by future management without
   governance board approval.

2. **The SOP corpus is a public good (partially).**
   Base-level SOP content for WHO Essential Health Package roles, basic legal
   aid, and primary education is made freely available — not locked behind the
   platform paywall. Organizations in low-income settings can use these base SOPs
   even if they can't afford the full platform.

3. **Annual impact reporting with third-party audit.**
   Publish, annually: how many surrogates are deployed in LMIC contexts,
   what operational hours were delivered, what the estimated impact was.
   Hold the company accountable to this publicly.

---

### Risk 4.2 — The Humanoid Creates Harm at Scale

**What could go wrong:**
A humanoid surrogate deployment, at scale, causes physical harm. Not a single incident
managed with a pilot protocol — but a systematic failure across multiple deployments.
The harm is amplified by the scale of deployment in a way that a human error at
the same scale would not be.

**Probability:** Low in the near term (deployments are controlled and supervised).
Higher in the long term as deployments scale and supervision decreases.

**Severity:** Potentially catastrophic — for individuals harmed and for the platform.

**Mitigation:**

1. **The humanoid authorization architecture is non-negotiable.**
   Every physical action involving a human requires: (a) AI confidence >98%,
   (b) explicit human authorization, (c) safety check simulation pass.
   This is not a policy. It is an architectural constraint that cannot be
   disabled by configuration.

2. **Scale slowly, certify at each scale level.**
   The deployment model is: 1 → 5 → 20 → 100 humanoids per setting.
   Each scale level requires a new safety assessment and governance committee
   review before proceeding. Scale is not a business decision — it is a
   safety committee decision.

3. **Design for the failure mode, not the success case.**
   The question is not "what happens when the humanoid performs correctly?"
   The question is "what is the worst thing that can happen when it fails,
   and have we designed the failure mode to be safe?"
   Every physical action plan is evaluated for: what happens if this goes wrong
   halfway through? The failure mode must always be more safe than the
   alternative of not acting.

---

## The Risk Summary Table

```
RISK                          PROBABILITY  SEVERITY  MITIGATION STATUS
──────────────────────────────────────────────────────────────────────
SOP hallucination             MEDIUM       CRITICAL  Expert gate required
Institutional memory breach   LOW          CRITICAL  Architecture isolation
Confidence overstatement      MEDIUM       HIGH      Asymmetric calibration
Slow regulated adoption       HIGH         MEDIUM    UAE + NHS fast-track
Well-funded competitor        MEDIUM       HIGH      Corpus moat, execute fast
Incumbent product launch      HIGH (5yr)   MEDIUM    Certify first, partner
Hiring velocity               MEDIUM       MEDIUM    Mission-brand, advisors
Public deployment failure     LOW          CRITICAL  Scoped pilots, governance
Access concentration          HIGH         MISSION   Structural commitment
Humanoid harm at scale        LOW (now)    CRITICAL  Auth architecture, staged
──────────────────────────────────────────────────────────────────────
```

---

## The Risk Conclusion

Every risk in this document is real. None of them is fatal if addressed proactively.

The pattern across all mitigations is the same: **governance before speed**.

The instinct in startup culture is to move fast and figure out the governance later.
In regulated professional services, that instinct is wrong. The governance IS the
product — it is what makes trust possible, and trust is the prerequisite for adoption.

Build the governance first. Build the audit trail first. Build the kill switch first.
Build the expert validation network first. Then build the product on top of that foundation.

It is slower. It is more expensive upfront. It is the only way this works in the
contexts that matter.

---

*"Risk is not what you acknowledge. Risk is what you're unprepared for."*

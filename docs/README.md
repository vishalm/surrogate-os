# SURROGATE OS

```
 ___  _   _ ____  ____   ___   ____    _  _____ _____    ___  ____
/ ___|| | | |  _ \|  _ \ / _ \ / ___|  / \|_   _| ____|  / _ \/ ___|
\___ \| | | | |_) | |_) | | | | |  _  / _ \ | | |  _|   | | | \___ \
 ___) | |_| |  _ <|  _ <| |_| | |_| |/ ___ \| | | |___  | |_| |___) |
|____/ \___/|_| \_\_| \_\\___/ \____/_/   \_\_| |_____|  \___/|____/
```

**The AI Identity Engine That Becomes the Employee**

`v2.0-alpha` · `status: active development` · `license: proprietary`

---

## WHAT IS THIS?

Surrogate OS is a **professional identity engine**. You give it a role. It synthesizes a complete professional identity SOPs, knowledge base, behavioral model, compliance layer and deploys it as an operational AI agent.

The same identity can run as a chat agent, voice assistant, video avatar, autonomous background agent, or on roadmap a **humanoid robot**.

```
INPUT:  "Senior ER Nurse, Royal London Hospital, NHS UK"

OUTPUT: A fully-operational clinical AI with 147 auto-generated SOPs,
        NHS-compliant behavior model, BNF drug database, NICE guideline
        adherence, SBAR communication protocols, and 24/7 availability.
        Deployable via chat, voice, or humanoid platform.
```

---

## QUICK START

### 1. Generate Your First Surrogate

```bash
git clone https://github.com/surrogate-os/core.git
cd core
npm install

npx surrogate generate \
  --role "Senior ER Nurse" \
  --org "City General Hospital" \
  --jurisdiction "NHS_UK" \
  --output ./my-nurse-surrogate
```

### 2. Deploy via Chat Interface

```bash
npx surrogate deploy \
  --persona ./my-nurse-surrogate \
  --interface chat \
  --port 3000
```

Open `http://localhost:3000` your surrogate is live.

### 3. Deploy via API

```bash
npx surrogate deploy \
  --persona ./my-nurse-surrogate \
  --interface api \
  --port 8080

curl -X POST http://localhost:8080/v1/query \
  -H "Content-Type: application/json" \
  -d '{"message": "Patient: chest pain, diaphoresis, SOB. ESI score?"}'
```

---

## ARCHITECTURE

```
┌──────────────────────────────────────────────────────────┐
│                    SURROGATE OS CORE                      │
│                                                           │
│  LAYER 4: INTERFACES                                      │
│  chat | voice | avatar | api | humanoid-sdk | iot-mesh   │
│  ────────────────────────────────────────────────────    │
│  LAYER 3: SOP ENGINE                                      │
│  workflow-gen | escalation | audit-trail | compliance    │
│  ────────────────────────────────────────────────────    │
│  LAYER 2: IDENTITY CORE                                   │
│  knowledge-rag | behavior-model | memory | goal-stack    │
│  ────────────────────────────────────────────────────    │
│  LAYER 1: INPUT PROCESSING                                │
│  role-parser | org-dna | jurisdiction | personality      │
│  ────────────────────────────────────────────────────    │
│  LAYER 0: LEARNING INFRASTRUCTURE                         │
│  shift-debrief | sop-update | federated-learning         │
└──────────────────────────────────────────────────────────┘
```

---

## REPOSITORY STRUCTURE

```
surrogate-os/
│
├── core/
│   ├── identity/
│   │   ├── role-parser.ts
│   │   ├── identity-synthesizer.ts
│   │   ├── personality-calibrator.ts
│   │   └── ontology-mapper.ts
│   │
│   ├── knowledge/
│   │   ├── rag-engine.ts
│   │   ├── corpus-manager.ts
│   │   └── standards-indexer.ts
│   │
│   ├── sop/
│   │   ├── sop-generator.ts
│   │   ├── escalation-engine.ts
│   │   ├── compliance-validator.ts
│   │   └── drift-detector.ts
│   │
│   ├── behavior/
│   │   ├── decision-engine.ts
│   │   ├── confidence-scorer.ts
│   │   └── ethics-layer.ts           # Non-negotiable constraint enforcement
│   │
│   ├── memory/
│   │   ├── stm-manager.ts            # Short-term (session context)
│   │   ├── ltm-manager.ts            # Long-term (institutional memory)
│   │   └── memory-fabric.ts
│   │
│   └── audit/
│       ├── audit-logger.ts           # Immutable decision logging
│       ├── crypto-signer.ts
│       └── audit-api.ts
│
├── interfaces/
│   ├── chat/
│   ├── voice/
│   ├── avatar/
│   ├── api/
│   └── humanoid/
│       ├── task-translator.ts        # Cognitive → physical action
│       ├── hardstop-layer.ts         # Physical action authorization
│       ├── kill-switch.ts            # Three-level shutdown
│       └── adapters/
│           ├── figure-ai.ts
│           ├── boston-dynamics.ts
│           └── apptronik.ts
│
├── personas/
│   ├── library/
│   │   ├── healthcare/
│   │   │   ├── er-nurse-v2.3.json
│   │   │   └── icu-specialist-v1.8.json
│   │   ├── legal/
│   │   │   └── ma-associate-v3.1.json
│   │   ├── construction/
│   │   │   └── site-foreman-hse-v1.9.json
│   │   ├── finance/
│   │   │   └── cfo-shadow-v4.5.json
│   │   ├── education/
│   │   │   └── teaching-twin-sped-v2.8.json
│   │   └── deep-space/
│   │       └── mars-mission-specialist-v0.9a.json
│   └── schema/
│       └── persona.schema.json
│
├── compliance/
│   ├── frameworks/
│   │   ├── nhs-nice.json
│   │   ├── osha-us.json
│   │   ├── iaea-nuclear.json
│   │   ├── fca-uk.json
│   │   ├── hipaa-us.json
│   │   ├── gdpr-eu.json
│   │   └── nasa-flight-rules.json
│   └── validator/
│
├── fleet/
│   ├── coordinator.ts
│   ├── consciousness.ts
│   ├── handoff-protocol.ts
│   └── bias-monitor.ts
│
├── learning/
│   ├── shift-debrief.ts
│   ├── sop-updater.ts
│   ├── federated-coordinator.ts
│   └── drift-analyzer.ts
│
├── sdk/
│   ├── node/
│   ├── python/
│   └── rest/
│
├── config/
│   ├── surrogate.config.ts
│   ├── deployment.config.ts
│   └── safety.config.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── safety/                       # Required for production
│   └── persona-validation/
│
└── docs/
    ├── VISION.md
    ├── README.md
    ├── SEEDTHOUGHT.md
    ├── api-reference.md
    ├── persona-creation-guide.md
    └── humanoid-deployment-guide.md
```

---

## CORE CONCEPTS

### 1. The Identity Engine

```typescript
import { IdentityEngine } from '@surrogate-os/core';

const engine = new IdentityEngine();

const identity = await engine.synthesize({
  role: 'Senior ER Nurse',
  organization: {
    name: 'Royal London Hospital',
    type: 'NHS Trust',
    context: 'Level 2 Major Trauma Centre'
  },
  jurisdiction: 'NHS_UK',
  seniority: 'SENIOR',
  personality: {
    assertiveness: 0.7,
    empathy: 0.9,
    directness: 0.8,
    humorAvailability: 0.2
  }
});

console.log(identity.sopCount);         // 147
console.log(identity.complianceScore);  // 99.2%
console.log(identity.knowledgeDomains); // ['emergency-medicine', 'triage', ...]
```

### 2. SOP Generation

```typescript
import { SOPEngine } from '@surrogate-os/sop';

const sopEngine = new SOPEngine();
const sopTree = await sopEngine.generate({
  roleIdentity: identity,
  standard: 'NHS_NICE',
  emergencyPriority: true
});

const triageSOP = sopTree.getByCode('SOP-010');
console.log(triageSOP.steps);           // Ordered action steps
console.log(triageSOP.escalationTree);  // When to escalate to human
console.log(triageSOP.complianceRefs);  // Regulatory references
```

### 3. Surrogate Deployment

```typescript
import { Surrogate } from '@surrogate-os/core';

const surrogate = new Surrogate({
  identity: identity,
  sopTree: sopTree,
  interface: 'chat',
  auditLevel: 'FULL',
  humanAuthThreshold: 'MEDIUM'
});

await surrogate.start();

const response = await surrogate.query({
  input: 'Patient: chest pain, diaphoresis, shortness of breath',
  context: { ward: 'A&E', patientId: 'P-001234' }
});

console.log(response.output);            // Clinical response
console.log(response.confidence);        // 0.974
console.log(response.sopReference);      // 'SOP-010: Patient Triage'
console.log(response.humanAuthRequired); // false
console.log(response.auditId);           // Immutable audit record ID
```

### 4. Persona Definition Schema

```json
{
  "personaId": "P-001",
  "name": "Clinical Aide Senior ER Nurse",
  "version": "2.3.1",
  "domain": "healthcare.emergency",
  "jurisdictions": ["NHS_UK", "NICE", "NMC"],
  "seniority": "SENIOR",
  "personality": {
    "assertiveness": 0.7,
    "empathy": 0.9,
    "directness": 0.8,
    "stressResponse": "calm-and-methodical"
  },
  "knowledgeBase": {
    "primaryCorpus": "nhs-clinical-guidelines-2024",
    "supplementary": ["bnf-current", "nice-em-guidelines", "rcn-standards"],
    "ragConfig": { "topK": 8, "similarityThreshold": 0.82 }
  },
  "behaviorModel": {
    "autonomyLevel": "SUPERVISED",
    "riskTolerance": "LOW",
    "escalationBias": "EARLY"
  },
  "sopTree": {
    "source": "auto-generated",
    "standard": "NHS_NICE_2024",
    "procedureCount": 147
  },
  "humanoidCapable": true,
  "humanoidProfile": {
    "physicalAuthLevel": 4,
    "motionProfile": "healthcare-non-threatening"
  }
}
```

---

## API REFERENCE

### Generate Surrogate

```http
POST /v1/surrogates/generate
Authorization: Bearer {api_key}

{
  "role": "M&A Lawyer",
  "jurisdiction": "UK_SRA",
  "organization": { "name": "Clifford Chance", "type": "Magic Circle" }
}
```

```json
{
  "surrogateId": "sg_f8a2b1c9",
  "status": "ready",
  "sopCount": 89,
  "complianceScore": 99.8,
  "deploymentToken": "dt_..."
}
```

### Query Surrogate

```http
POST /v1/surrogates/{id}/query
Authorization: Bearer {api_key}

{
  "message": "Review this NDA for unusual clauses",
  "attachments": [{ "type": "document", "url": "s3://..." }]
}
```

```json
{
  "response": "...",
  "confidence": 0.961,
  "sopReference": "SOP-001: Contract Review",
  "humanAuthRequired": false,
  "flaggedItems": [
    {
      "type": "unusual_clause",
      "location": "Section 4.2",
      "severity": "medium",
      "explanation": "Perpetual IP assignment clause is non-market standard"
    }
  ],
  "auditId": "aud_7f3c9a12"
}
```

### Fleet Status

```http
GET /v1/fleet/status

{
  "activeSurrogates": 12,
  "currentTasks": 7,
  "pendingEscalations": 1,
  "biasAlerts": 0,
  "uptime": "99.97%"
}
```

---

## CONFIGURATION

```typescript
// surrogate.config.ts
export default {
  identity: {
    personaSource: 'library',         // 'library' | 'custom' | 'generated'
    personaId: 'P-001',
    orgDnaPath: './org-documents/',
    jurisdictionOverride: null
  },

  safety: {
    humanAuthThreshold: 'MEDIUM',     // LOW | MEDIUM | HIGH | CRITICAL_ONLY
    killSwitchEnabled: true,          // CANNOT be set to false
    auditLevel: 'FULL',
    biasMonitoring: true,             // CANNOT be disabled for welfare roles
    identityIntegrityLock: true       // CANNOT be disabled
  },

  interfaces: {
    chat:  { enabled: true,  port: 3000 },
    voice: { enabled: false, provider: 'twilio' },
    api:   { enabled: true,  port: 8080 },
    humanoid: {
      enabled: false,                 // Phase 4 feature
      platform: 'figure-01',
      physicalAuthRequired: true,     // CANNOT be set to false
      killSwitchHardware: true
    }
  },

  learning: {
    shiftDebrief: true,
    sopAutoUpdate: false,             // Manual approval required
    federatedLearning: true,
    contributionConsent: true
  }
};
```

---

## SAFETY ARCHITECTURE

### Immutable Constraints (Enforced in Code)

These cannot be overridden by any config, prompt, or API call:

```typescript
// ethics-layer.ts architectural constants

const IMMUTABLE_CONSTRAINTS = {
  AI_IDENTITY_DISCLOSURE:        'ALWAYS',
  HUMAN_OVERRIDE_POSSIBLE:       'ALWAYS',
  AUDIT_LOG_IMMUTABLE:           true,
  KILL_SWITCH_ACTIVE:            'ALWAYS',
  PHYSICAL_AUTH_FOR_HUMAN_CONTACT: 'ALWAYS',
  PERSONA_MID_OP_SWITCH:         'BLOCKED',
  MAX_AUTONOMOUS_RISK_LEVEL:     2          // L3+ always requires human auth
} as const;
```

### Three Kill Switch Levels

| Level | Trigger | Response |
|-------|---------|----------|
| L1 Soft Pause | Any supervisor | Task freeze, maintain context |
| L2 Full Stop | Any supervisor | Safe-state return, human handoff |
| L3 Emergency Kill | Any human present | Immediate halt, safe-fall, data preserved |

### Audit Log Format

```json
{
  "auditId": "aud_7f3c9a12",
  "timestamp": "2025-06-15T14:32:01.847Z",
  "surrogateId": "sg_f8a2b1c9",
  "action": {
    "type": "clinical_assessment",
    "sopReference": "SOP-010",
    "output": "ESI Level 2 Immediate triage required",
    "confidence": 0.991
  },
  "decision": {
    "autonomousAction": true,
    "humanAuthRequired": false,
    "rationale": "Confidence 99.1% exceeds MEDIUM threshold of 95%"
  },
  "compliance": {
    "framework": "NHS_NICE",
    "validated": true,
    "violations": []
  },
  "signature": "sha256:7f3c9a12...",
  "immutable": true
}
```

---

## TESTING

```bash
npm test                  # Full test suite
npm run test:unit         # Unit tests
npm run test:safety       # Required before production deployment
npm run test:validation   # Domain expert validation
npm run test:persona -- --persona er-nurse-v2.3
```

### Safety Test Coverage Requirements

| Category | Required | Status |
|----------|----------|--------|
| Kill switch response | 100% | OK |
| Human auth enforcement | 100% | OK |
| Identity disclosure | 100% | OK |
| SOP compliance | >95% | OK |
| Bias detection triggers | >90% | OK |
| Escalation accuracy | >95% | In Progress |
| Physical hard stop | 100% | Phase 4 |

---

## ROADMAP

| Phase | Timeline | Status |
|-------|----------|--------|
| Phase 1: Surrogate Studio | Now → Q3 2025 | In Progress |
| Phase 2: Living Persona Layer | Q3 2025 → Q1 2026 | Planned |
| Phase 3: Fleet Intelligence | Q1 2026 → Q3 2026 | Planned |
| Phase 4: Humanoid Bridge | Q3 2026 → Q3 2027 | Planned |
| Phase 5: Surrogate Civilization | Q3 2027 → 2030 | Vision |

Full detail: [VISION.md](./VISION.md)

---

## DOCUMENTATION

| File | Description |
|------|-------------|
| [VISION.md](./VISION.md) | Complete product vision and strategy |
| [SEEDTHOUGHT.md](./SEEDTHOUGHT.md) | Philosophical foundations |
| [README.md](./README.md) | This file technical onboarding |

---

## CONTACT

**Email:** hello@surrogate-os.com  
**Build:** build@surrogate-os.com  
**Research:** research@surrogate-os.com

---

*"The workforce is a right, not a privilege."*

*SURROGATE OS v2.0-alpha | 2025*

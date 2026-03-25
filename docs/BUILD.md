# BUILD.md
## The Technical Blueprint How Surrogate OS Is Actually Built

---

> *"Architecture is the set of decisions that are hardest to change later.
>  Get these right first."*

---

## Engineering Philosophy

Three principles govern every technical decision in Surrogate OS:

1. **Identity is the primitive, not the query.** Every system is optimized around the
   persistent professional identity, not the individual interaction.

2. **The SOP is executable, not descriptive.** SOPs are not documents stored as text.
   They are structured operational graphs that the system actively traverses during
   task execution.

3. **The audit trail is primary, not secondary.** Logging is not added to the system.
   The audit trail IS the system. Every other component writes to it as the core
   operational truth.

---

## System Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     SURROGATE OS RUNTIME                       │
│                                                                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │  IDENTITY    │   │  SOP ENGINE  │   │  AUDIT FABRIC    │  │
│  │  CORE        │◄──►              │◄──►                  │  │
│  │              │   │  · Workflow  │   │  · Decision log  │  │
│  │  · Persona   │   │  · Escalation│   │  · Rationale     │  │
│  │  · Knowledge │   │  · Compliance│   │  · Confidence    │  │
│  │  · Memory    │   │  · Auth gate │   │  · Auth chain    │  │
│  │  · Goals     │   │              │   │  · Timestamp     │  │
│  └──────┬───────┘   └──────┬───────┘   └──────────────────┘  │
│         │                  │                                   │
│  ┌──────▼──────────────────▼────────────────────────────────┐ │
│  │                    INTERFACE LAYER                        │ │
│  │  Chat │ Voice │ Avatar │ API │ AR Overlay │ Humanoid SDK  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    LEARNING LAYER                         │ │
│  │  Shift Debrief │ SOP Delta │ Federated Sync │ Corpus Push │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## Component 1: The Identity Core

The Identity Core is the persistent state object that defines a surrogate. It is not
a prompt it is a structured data object with multiple subsystems.

### 1.1 Persona Object Schema

```typescript
interface SurrogatePersona {
  id: string;                          // Unique surrogate identifier
  role: ProfessionalRole;              // Parsed role definition
  identity: IdentityProfile;           // Behavioral calibration
  knowledge: KnowledgeIndex;           // Domain RAG configuration
  memory: MemoryFabric;               // Short + long term memory
  sop_set: SOPGraph[];                // Active SOP collection
  authorization_scope: AuthScope;     // What this surrogate can do
  audit_config: AuditConfiguration;   // Logging behavior
  deployment_context: DeploymentCtx;  // Org, jurisdiction, interface
  meta: PersonaMeta;                  // Version, certification status
}

interface ProfessionalRole {
  title: string;                       // "Senior ER Nurse"
  seniority: SeniorityLevel;
  domain: IndustryDomain;
  sub_domain: string;                  // "Level 2 Trauma"
  organization_type: OrgType;          // "NHS Trust"
  jurisdiction: Jurisdiction[];        // ["UK", "NHS", "NICE"]
  certification_requirements: string[];
}

interface IdentityProfile {
  communication_style: CommStyle;
  assertiveness_level: number;         // 0.0–1.0
  empathy_bias: number;               // 0.0–1.0
  risk_tolerance: number;             // 0.0–1.0
  escalation_threshold: number;       // Confidence below which → escalate
  language_register: LanguageRegister;
  cultural_context: CulturalProfile;
}
```

### 1.2 Knowledge Index Architecture

The Knowledge Index is a retrieval-augmented generation configuration,
not a static model. It defines which corpora to query and how to weight them.

```typescript
interface KnowledgeIndex {
  primary_corpus: CorpusReference[];   // Domain-specific sources
  secondary_corpus: CorpusReference[]; // General reference sources
  org_specific: OrgCorpusReference[];  // Organization-specific docs
  retrieval_strategy: RetrievalConfig; // Query routing rules
  confidence_thresholds: {
    act: number;          // Confidence above this → execute
    advise: number;       // Confidence above this → recommend
    escalate: number;     // Confidence below this → escalate
    refuse: number;       // Confidence below this → refuse and flag
  };
}

// Example: Clinical surrogate corpus configuration
const clinicalCorpora: CorpusReference[] = [
  { id: "nice_guidelines", weight: 0.95, jurisdiction: "UK" },
  { id: "bnf_formulary",   weight: 0.99, jurisdiction: "UK" },
  { id: "who_protocols",   weight: 0.80, jurisdiction: "GLOBAL" },
  { id: "pubmed_clinical", weight: 0.70, jurisdiction: "GLOBAL" },
  { id: "nhs_policies",    weight: 0.90, jurisdiction: "UK_NHS" },
  { id: "rcseng_guidance", weight: 0.85, jurisdiction: "UK" },
];
```

### 1.3 Memory Fabric

The Memory Fabric is a three-tier memory system:

```
TIER 1: WORKING MEMORY (session scope)
  → Current task context, recent interactions, active SOP state
  → TTL: End of session
  → Storage: In-process vector cache
  → Size: ~8K tokens active context

TIER 2: SHIFT MEMORY (deployment instance scope)
  → Everything that happened in current shift/deployment period
  → Cross-session but not cross-deployment
  → Storage: Encrypted session store (Redis cluster)
  → Retention: 30 days post-session

TIER 3: INSTITUTIONAL MEMORY (org-surrogate scope)
  → Long-term organizational knowledge, learned preferences,
    edge case resolutions, cultural nuances
  → Persistent across deployments, specific to org-persona pair
  → Storage: Encrypted persistent vector DB (per-org partition)
  → Retention: Duration of deployment contract + 7 years (compliance)
```

---

## Component 2: The SOP Engine

The SOP Engine is the core differentiator. It is not a prompt template.
It is a structured operational graph execution system.

### 2.1 SOP Graph Structure

```typescript
interface SOPGraph {
  id: string;                          // "SOP_CLINICAL_TRIAGE_v2.4.1"
  version: SemanticVersion;
  certification_status: CertStatus;
  jurisdiction: Jurisdiction[];
  trigger_conditions: TriggerSet;      // When this SOP activates
  entry_point: SOPNode;
  nodes: Map<string, SOPNode>;
  edges: SOPEdge[];
  exit_conditions: ExitCondition[];
  escalation_paths: EscalationPath[];
  failure_modes: FailureMode[];
  audit_requirements: AuditRequirement[];
}

interface SOPNode {
  id: string;
  type: NodeType;                      // DECISION | ACTION | CHECKPOINT | ESCALATION
  description: string;
  confidence_requirement: number;      // Min confidence to proceed
  human_auth_required: boolean;        // Must human approve before execution?
  auth_level: AuthorizationLevel;      // Who can authorize
  timeout: Duration;                   // How long to wait before escalating
  on_success: string;                  // Next node ID
  on_failure: EscalationPath;
  on_timeout: EscalationPath;
  audit_level: AuditLevel;            // FULL | SUMMARY | NONE
}

type NodeType =
  | "INFORMATION_GATHER"   // Collect data (vitals, docs, etc.)
  | "ASSESSMENT"           // Evaluate and score
  | "DECISION"             // Choose between paths
  | "ACTION_DIGITAL"       // Digital action (send message, log, calculate)
  | "ACTION_PHYSICAL"      // Physical action (requires higher auth)
  | "CHECKPOINT"           // Human review point
  | "ESCALATION"           // Hand off to human
  | "DOCUMENTATION"        // Generate record
  | "HANDOVER"             // Transfer to another surrogate or human
```

### 2.2 SOP Auto-Generation Pipeline

```
INPUT: Role definition + jurisdiction + org context
         │
         ▼
┌─────────────────────┐
│  ONTOLOGY MAPPING   │  Parse role → professional domain ontology
│                     │  Map to applicable standards bodies
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  CORPUS RETRIEVAL   │  Query standards corpus for:
│                     │  - Core procedural requirements
│                     │  - Escalation thresholds
│                     │  - Documentation standards
│                     │  - Compliance requirements
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  GRAPH SYNTHESIS    │  Convert retrieved procedures to SOPGraph
│                     │  Identify decision points, auth requirements,
│                     │  failure modes, escalation paths
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  EXPERT VALIDATION  │  Domain expert reviews graph
│                     │  Red-team: edge cases, failure modes
│                     │  Annotate with confidence adjustments
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  CERTIFICATION      │  Governance committee sign-off
│                     │  Cryptographic signature applied
│                     │  Published to certified SOP registry
└─────────────────────┘

OUTPUT: Certified SOPGraph with immutable signature, ready for deployment
```

### 2.3 Runtime SOP Traversal

During operation, the surrogate traverses the SOP graph in real time:

```python
class SOPTraversal:
    def execute_node(self, node: SOPNode, context: ExecutionContext) -> NodeResult:

        # 1. Check confidence
        confidence = self.assess_confidence(node, context)
        if confidence < node.confidence_requirement:
            return self.escalate(node, context, reason="LOW_CONFIDENCE")

        # 2. Check authorization requirement
        if node.human_auth_required:
            auth = self.request_authorization(node, context)
            if not auth.granted:
                return self.escalate(node, context, reason="AUTH_DENIED")
            self.audit.log_authorization(node, auth)

        # 3. Execute node action
        try:
            result = self.execute_action(node, context)
            self.audit.log_action(node, result, confidence)
            return NodeResult(success=True, next_node=node.on_success)

        except ActionException as e:
            self.audit.log_failure(node, e)
            return self.traverse_failure_mode(node, e, context)

        except TimeoutException:
            self.audit.log_timeout(node)
            return self.traverse_escalation(node.on_timeout, context)
```

---

## Component 3: The Audit Fabric

Every other component writes to the Audit Fabric. It is the source of truth.

### 3.1 Audit Entry Schema

```typescript
interface AuditEntry {
  // Identity
  entry_id: string;                    // Globally unique, immutable
  surrogate_id: string;
  organization_id: string;
  deployment_id: string;

  // Timing
  timestamp: ISO8601;
  session_id: string;
  shift_id: string;

  // What happened
  entry_type: AuditEntryType;
  sop_reference: string;               // Which SOP, which node
  action_taken: ActionDescriptor;
  action_rationale: RationaleTree;     // Full reasoning chain

  // Confidence
  confidence_score: number;            // 0.0–1.0
  confidence_components: {
    knowledge_retrieval: number;
    sop_alignment: number;
    context_clarity: number;
    precedent_match: number;
  };

  // Authorization
  human_auth_required: boolean;
  human_auth_record: AuthRecord | null;

  // Outcome
  immediate_outcome: OutcomeDescriptor;
  follow_up_required: boolean;
  escalation_triggered: boolean;

  // Integrity
  hash: string;                        // SHA-256 of entry content
  previous_hash: string;               // Chain linkage (blockchain-style)
  signature: string;                   // Platform cryptographic signature
}
```

### 3.2 Audit Chain Integrity

The audit trail uses a blockchain-style chained hash structure. Every entry
references the hash of the previous entry. Tampering with any entry invalidates
all subsequent hashes making retroactive modification detectable.

```
Entry N:   { ...content, hash: H(content + H(N-1)) }
Entry N+1: { ...content, hash: H(content + H(N)) }
Entry N+2: { ...content, hash: H(content + H(N+1)) }

If Entry N is modified:
  H(N) changes → H(N+1) invalidates → H(N+2) invalidates → ...
  Detected immediately on any verification check
```

This is the technical foundation for the regulatory accountability claim.
It provides mathematical proof that the audit trail has not been altered.

---

## Component 4: The Interface Layer

### 4.1 Interface Abstraction

All interfaces consume from the same surrogate runtime through a unified API:

```typescript
interface SurrogateInterface {
  // Core interaction
  send(message: Message): Promise<SurrogateResponse>;
  stream(message: Message): AsyncIterator<ResponseChunk>;

  // Action execution
  execute_action(action: ActionRequest): Promise<ActionResult>;
  request_authorization(action: ActionRequest): Promise<AuthorizationResponse>;

  // State
  get_active_sop(): SOPGraph | null;
  get_memory_summary(): MemorySummary;
  get_audit_trail(filter: AuditFilter): AuditEntry[];

  // Control
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(level: StopLevel): Promise<void>;        // L1, L2, or L3 kill
  handoff(target: HandoffTarget): Promise<void>; // To human or other surrogate
}
```

### 4.2 Humanoid SDK Architecture

The Humanoid SDK translates cognitive decisions to physical commands:

```typescript
interface HumanoidBridge {
  // Perception input
  ingest_camera(feed: VideoStream): void;
  ingest_lidar(data: LidarFrame): void;
  ingest_audio(feed: AudioStream): void;
  ingest_sensor(data: SensorReading[]): void;

  // Spatial awareness
  get_environment_model(): EnvironmentGraph;
  locate_target(target: TargetDescriptor): PhysicalLocation | null;

  // Action translation
  translate_cognitive_task(
    task: CognitiveTask,              // "Perform patient check"
    sop_context: SOPNode,             // The SOP node this is part of
    environment: EnvironmentGraph
  ): PhysicalActionPlan;             // Decomposed into motor primitives

  // Physical execution
  execute_action_plan(
    plan: PhysicalActionPlan,
    auth: AuthorizationRecord,        // Always required for physical actions
    confidence_threshold: number      // Min confidence to proceed
  ): Promise<PhysicalActionResult>;

  // Safety
  emergency_stop(): void;             // Hardware-level, bypasses software
  return_to_safe_position(): Promise<void>;
}

interface PhysicalActionPlan {
  steps: MotorPrimitive[];
  estimated_duration: Duration;
  confidence: number;
  reversible: boolean;
  human_contact_involved: boolean;    // Triggers higher auth requirement
  safety_checks: SafetyCheck[];
}
```

---

## Component 5: The Learning Layer

### 5.1 Shift Debrief System

After every operational period, the surrogate runs a structured debrief:

```python
class ShiftDebrief:
    def run(self, shift_record: ShiftRecord) -> DebriefReport:

        # 1. SOP Adherence Analysis
        sop_delta = self.compute_sop_delta(
            executed=shift_record.actions_taken,
            prescribed=shift_record.sop_prescribed_actions
        )

        # 2. Deviation Classification
        for deviation in sop_delta.deviations:
            deviation.classification = self.classify_deviation(deviation)
            # Classifications: ESCALATION | EDGE_CASE | ORG_NUANCE | POTENTIAL_ERROR

        # 3. Outcome Correlation
        outcomes = self.correlate_with_outcomes(shift_record)
        # "Actions A, B, C correlated with positive outcome X"
        # "Action D correlated with escalation Y flag for SOP review"

        # 4. Edge Case Extraction
        edge_cases = self.extract_edge_cases(shift_record)
        # Cases where SOP was insufficient → feed to SOP update queue

        # 5. Institutional Learning
        org_nuances = self.extract_org_nuances(shift_record)
        # Org-specific patterns → add to institutional memory

        # 6. Federated Contribution (anonymized)
        federated_signal = self.prepare_federated_signal(sop_delta, outcomes, edge_cases)
        # Stripped of org-identifying information → contribute to global corpus

        return DebriefReport(sop_delta, outcomes, edge_cases, org_nuances)
```

### 5.2 Federated Learning Architecture

Privacy is preserved through differential privacy and federated aggregation:

```
ORG A SURROGATE          ORG B SURROGATE         ORG C SURROGATE
       │                        │                        │
  Local training            Local training          Local training
  on org A data             on org B data           on org C data
       │                        │                        │
  DP noise added            DP noise added          DP noise added
  (ε = 0.1)                 (ε = 0.1)               (ε = 0.1)
       │                        │                        │
  Gradient only             Gradient only           Gradient only
  (no raw data)             (no raw data)           (no raw data)
       └───────────────────────┬────────────────────────┘
                               │
                    FEDERATED AGGREGATOR
                    (Secure multi-party computation)
                               │
                    Global model update
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         ORG A gets        ORG B gets       ORG C gets
         improved model    improved model   improved model
         (learned from     (learned from    (learned from
          all, exposed       all, exposed     all, exposed
          none)              none)            none)
```

No organization's data ever leaves their environment.
No organization can reconstruct another organization's data from the model updates.
The global model improves as if it had access to all data without actually having it.

---

## Tech Stack Decisions

### Core Runtime

```
LLM BACKBONE:        Anthropic Claude API (enterprise, SOC2, HIPAA eligible)
VECTOR DB:           Weaviate (self-hosted per org for data sovereignty)
MEMORY STORE:        Redis Enterprise (encrypted, per-org isolation)
AUDIT DB:            PostgreSQL with append-only tables + cryptographic chain
ORCHESTRATION:       LangGraph (stateful agent workflows)
SOP GRAPH ENGINE:    Custom built on top of directed graph primitives
CORPUS RETRIEVAL:    Custom RAG pipeline with jurisdiction-aware routing
```

### Infrastructure

```
DEPLOYMENT:          Kubernetes (org-specific namespaces for isolation)
SECURITY:            Zero-trust network, mTLS everywhere
ENCRYPTION:          AES-256 at rest, TLS 1.3 in transit
KEY MANAGEMENT:      HashiCorp Vault (org-specific key hierarchies)
AUDIT CHAIN:         Immutable append-only PostgreSQL + periodic Merkle anchoring
FEDERATED LEARNING:  PySyft (differential privacy framework)
HUMANOID SDK:        gRPC-based, protocol buffer schemas for motor primitives
```

### Compliance Infrastructure

```
HIPAA:       BAA-eligible infrastructure, audit log retention 7 years
SOC 2 II:    Type II audit in Year 1 roadmap
GDPR:        Data residency controls, right-to-erasure (excluding audit trail)
ISO 27001:   Certification roadmap Year 1-2
NHS DSP:     Data Security and Protection Toolkit compliance
FCA:         SMCR documentation framework, algorithmic decision logging
```

---

## The MVP Architecture What Ships First

The MVP is not the full system. It is the smallest deployable slice that proves the core thesis.

**MVP Definition:**

```
INPUT:   Role title + org type + jurisdiction (text form)
PROCESS: SOP generation pipeline → persona hydration → chat interface
OUTPUT:  A deployed chat surrogate with generated SOPs and basic audit trail

WHAT'S IN:                         WHAT'S OUT (later):
✓ Role parsing                     ✗ Voice interface
✓ SOP auto-generation (3 verticals) ✗ Avatar
✓ Chat interface                   ✗ Humanoid SDK
✓ Basic audit trail                ✗ Federated learning
✓ Human escalation                 ✗ Fleet consciousness
✓ Org DNA ingestion (docs upload)  ✗ Live SOP self-update
✓ Tool use (web search, docs)      ✗ IoT integration
✓ Session memory                   ✗ Institutional memory (v2)
```

**MVP Success Criteria:**

A domain expert reviewing the deployed surrogate's SOP output says:
*"This is good enough to work from. With one hour of review and annotation,
this could be deployed in a real professional context."*

That is the bar. Not perfect. Good enough to work from.

---

## The Engineering Team You Need

**Year 1 core team (6–8 people):**

```
ROLE                        KEY SKILL
─────────────────────────────────────────────────────────────────
CTO / Lead Architect        LLM application architecture,
                            stateful agent systems, enterprise infra

Senior AI Engineer (×2)     RAG systems, LLM fine-tuning,
                            structured output, agent frameworks

Backend Engineer (×2)       Distributed systems, PostgreSQL,
                            security infrastructure, API design

Domain Expert Consultant    Deep expertise in first target vertical
(Clinical or Legal)         (validates SOPs, governs quality)

Compliance Engineer         HIPAA/SOC2/ISO27001, audit systems,
                            regulatory documentation

Product Manager             Enterprise AI product, regulated industry
                            deployment experience preferred
```

**Year 2 additions:**

```
Humanoid SDK Engineer       Robotics middleware, ROS, motor control APIs
Federated Learning Eng.     PySyft, differential privacy, distributed ML
Second Domain Vertical      Expand from healthcare to legal or finance
Customer Success (×2)       Deployment support, pilot management
```

---

## The Hardest Technical Problems Honest Assessment

### Problem 1: SOP Hallucination in High-Stakes Contexts
Generated SOPs may contain plausible-sounding but incorrect procedural guidance.
In a clinical context, this is a patient safety risk.

**Mitigation strategy:** Expert validation gate before any SOP is deployed.
No SOP goes live without domain expert sign-off. The generator accelerates expert work;
it does not replace expert judgment on correctness.

### Problem 2: Confidence Calibration
The surrogate must know when it doesn't know. Over-confident surrogates in clinical
contexts that should escalate are dangerous.

**Mitigation strategy:** Calibrated uncertainty throughout retrieval and generation.
Default to escalation when confidence is ambiguous. Threshold calibrated conservatively
(escalate too much is better than act incorrectly).

### Problem 3: Institutional Memory Privacy
Long-term memory that accumulates org-specific knowledge creates privacy risks if
not properly isolated and protected.

**Mitigation strategy:** Per-org encryption keys (org holds, not us), strict namespace
isolation in vector DB, no cross-org memory leakage possible by architecture.

### Problem 4: Humanoid Action Irreversibility
Physical actions cannot be undone. A humanoid surrogate that takes a wrong physical
action in a clinical environment can cause immediate harm.

**Mitigation strategy:** Every physical action plan: (a) assessed for reversibility,
(b) requires human authorization, (c) runs safety simulation before execution,
(d) hardware-level emergency stop available at any moment. High-risk physical actions
require supervisor presence.

---

*"Build what you need to prove the thesis. Then build what the thesis demands."*

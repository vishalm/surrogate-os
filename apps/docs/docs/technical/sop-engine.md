---
sidebar_position: 3
title: "SOP Engine"
description: "The structured operational graph execution system — how SOPs are generated, validated, and traversed at runtime."
---

# SOP Engine

The SOP Engine is the core differentiator. It is not a prompt template. It is a **structured operational graph execution system**.

---

## SOP Graph Structure

```typescript
interface SOPGraph {
  id: string;                          // "SOP_CLINICAL_TRIAGE_v2.4.1"
  version: SemanticVersion;
  certification_status: CertStatus;
  jurisdiction: Jurisdiction[];
  trigger_conditions: TriggerSet;
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
  type: NodeType;
  description: string;
  confidence_requirement: number;
  human_auth_required: boolean;
  auth_level: AuthorizationLevel;
  timeout: Duration;
  on_success: string;                  // Next node ID
  on_failure: EscalationPath;
  on_timeout: EscalationPath;
  audit_level: AuditLevel;
}

type NodeType =
  | "INFORMATION_GATHER"   // Collect data (vitals, docs, etc.)
  | "ASSESSMENT"           // Evaluate and score
  | "DECISION"             // Choose between paths
  | "ACTION_DIGITAL"       // Digital action (send, log, calculate)
  | "ACTION_PHYSICAL"      // Physical action (requires higher auth)
  | "CHECKPOINT"           // Human review point
  | "ESCALATION"           // Hand off to human
  | "DOCUMENTATION"        // Generate record
  | "HANDOVER"             // Transfer to another surrogate or human
```

---

## Auto-Generation Pipeline

```mermaid
flowchart TD
    INPUT["<b>INPUT</b><br/>Role definition + Jurisdiction + Org context"]
    OM["<b>Ontology Mapping</b><br/>Parse role → professional domain ontology"]
    CR["<b>Corpus Retrieval</b><br/>Query standards for procedures,<br/>escalation thresholds, documentation"]
    GS["<b>Graph Synthesis</b><br/>Convert to SOPGraph with decision points,<br/>auth requirements, failure modes"]
    EV["<b>Expert Validation</b><br/>Domain expert reviews graph, red-teams<br/>edge cases, annotates confidence"]
    CERT["<b>Certification</b><br/>Governance sign-off, cryptographic<br/>signature, published to registry"]
    OUTPUT["<b>OUTPUT</b><br/>Certified SOPGraph with immutable signature"]

    INPUT --> OM --> CR --> GS --> EV --> CERT --> OUTPUT

    style INPUT fill:#4f46e5,color:#fff,stroke:none
    style OUTPUT fill:#059669,color:#fff,stroke:none
    style CERT fill:#7c3aed,color:#fff,stroke:none
    style EV fill:#d97706,color:#fff,stroke:none
```

### Example: Senior ER Nurse SOP Tree

```mermaid
graph TD
    ROOT["<b>Senior ER Nurse</b><br/>147 SOPs across 4 tiers"]

    T1["<b>TIER 1</b><br/>Immediate Life-Threatening"]
    T2["<b>TIER 2</b><br/>Urgent Clinical"]
    T3["<b>TIER 3</b><br/>Operational"]
    T4["<b>TIER 4</b><br/>Administrative"]

    ROOT --> T1 & T2 & T3 & T4

    T1 --> S001["SOP-001<br/>Code Blue"] & S002["SOP-002<br/>Airway Emergency"] & S003["SOP-003<br/>Haemorrhagic Shock"] & S004["SOP-004<br/>Anaphylaxis"]

    T2 --> S010["SOP-010<br/>Patient Triage"] & S011["SOP-011<br/>Medication Admin"] & S012["SOP-012<br/>IV Access"] & S013["SOP-013<br/>Wound Assessment"]

    T3 --> S020["SOP-020<br/>Patient Handover"] & S021["SOP-021<br/>Documentation"] & S022["SOP-022<br/>Family Comms"]

    T4 --> S030["SOP-030<br/>Shift Report"] & S031["SOP-031<br/>Incident Reporting"]

    style ROOT fill:#4f46e5,color:#fff,stroke:none
    style T1 fill:#dc2626,color:#fff,stroke:none
    style T2 fill:#d97706,color:#fff,stroke:none
    style T3 fill:#2563eb,color:#fff,stroke:none
    style T4 fill:#6b7280,color:#fff,stroke:none
```

---

## Runtime SOP Traversal

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

## The Learning Loop

```mermaid
graph LR
    D["Deploy"] --> A["Action"] --> O["Outcome"] --> DB["Debrief"] --> U["SOP Update"] --> ID["Improved<br/>Deployment"]
    ID -.-> D

    style D fill:#4f46e5,color:#fff,stroke:none
    style ID fill:#059669,color:#fff,stroke:none
```

Every action is logged with context, compared against SOP-specified outcomes, and analyzed for drift. Systematic deviations that produce better outcomes become SOP update candidates — reviewed and approved by humans before implementation.

### Shift Debrief System

```python
class ShiftDebrief:
    def run(self, shift_record: ShiftRecord) -> DebriefReport:
        # 1. SOP Adherence Analysis
        sop_delta = self.compute_sop_delta(executed, prescribed)

        # 2. Deviation Classification
        # ESCALATION | EDGE_CASE | ORG_NUANCE | POTENTIAL_ERROR

        # 3. Outcome Correlation
        # Positive outcome correlation → flag for SOP enhancement

        # 4. Edge Case Extraction
        # Cases where SOP was insufficient → feed to SOP update queue

        # 5. Institutional Learning
        # Org-specific patterns → add to institutional memory

        # 6. Federated Contribution (anonymized)
        # Stripped of org-identifying information → global corpus
```

---

*Next: [Audit Fabric](/docs/technical/audit-fabric) · [API Reference](/docs/technical/api-reference)*

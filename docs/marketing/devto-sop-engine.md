---
title: How I Designed a 9-Node SOP Decision Graph for AI Agents
published: false
description: Most AI agent frameworks treat agents as black boxes. We built explicit, auditable decision graphs instead.
tags: ai, typescript, agents, architecture
cover_image:
---

## The Black Box Problem

Most AI agent frameworks work like this: you give the LLM a system prompt, some tools, and hope for the best. The agent makes decisions, but you can't explain *why* it chose a particular path. You can't audit it. You can't certify it for regulated industries.

Try deploying that in a hospital. Or a bank. Good luck with your compliance audit.

We built something different.

## Surrogate OS: Explicit Decision Graphs

Surrogate OS generates complete AI employees from role descriptions. At the core of every surrogate is a **Standard Operating Procedure (SOP)** -- not a prompt, but a directed acyclic graph that defines how the surrogate makes decisions.

Every SOP graph uses exactly 9 node types:

| Node | Purpose |
|------|---------|
| `INFORMATION_GATHER` | Collect data before deciding |
| `ASSESSMENT` | Analyze the gathered information |
| `DECISION` | Make a choice between paths |
| `ACTION` | Execute a concrete step |
| `ESCALATION` | Hand off to a human when thresholds are exceeded |
| `CHECKPOINT` | Validate state before continuing |
| `NOTIFICATION` | Alert stakeholders |
| `DOCUMENTATION` | Record what happened and why |
| `HANDOFF` | Transfer to another surrogate or system |

## How Graphs Get Generated

When you create a surrogate from a role description, the system uses LLM tool-use to generate SOP graphs. The LLM doesn't just write a prompt -- it builds a structured graph:

```typescript
interface SOPNode {
  id: string;
  type: SOPNodeType; // One of the 9 types
  name: string;
  description: string;
  instructions: string;
  edges: SOPEdge[];
  escalationThreshold?: number;
  requiredEvidence?: string[];
}

interface SOPEdge {
  targetNodeId: string;
  condition: string;
  priority: number;
}
```

Each node has typed edges with conditions. The graph engine evaluates conditions at runtime to determine traversal path.

## Validation: No Broken Graphs

Before any SOP graph is accepted, it passes through validation:

- **Cycle detection** -- SOPs must be DAGs. Infinite loops in medical decision-making are bad.
- **Required node checks** -- Every SOP must include at minimum: one `INFORMATION_GATHER`, one `DECISION`, one `ESCALATION`, and one `DOCUMENTATION` node.
- **Reachability analysis** -- Every node must be reachable from the entry point. No orphaned logic.
- **Escalation path verification** -- There must always be a path to human oversight.

```typescript
// Simplified validation
function validateSOPGraph(graph: SOPGraph): ValidationResult {
  const errors: string[] = [];

  if (hasCycles(graph)) {
    errors.push('SOP graph contains cycles');
  }

  const requiredTypes = [
    'INFORMATION_GATHER',
    'DECISION',
    'ESCALATION',
    'DOCUMENTATION'
  ];

  for (const type of requiredTypes) {
    if (!graph.nodes.some(n => n.type === type)) {
      errors.push(`Missing required node type: ${type}`);
    }
  }

  const unreachable = findUnreachableNodes(graph);
  if (unreachable.length > 0) {
    errors.push(`Unreachable nodes: ${unreachable.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}
```

## Execution: Live Graph Traversal

When a surrogate handles an interaction, the execution engine walks the graph in real time:

1. Start at the entry node (usually `INFORMATION_GATHER`)
2. Execute the node's instructions using LLM tool-use
3. Evaluate outgoing edge conditions
4. Traverse to the next node based on the highest-priority matching condition
5. At every node, log the decision context to the audit trail
6. If an `ESCALATION` node is reached, pause and notify a human

The key insight: **every step is traceable.** You can reconstruct exactly why a surrogate made a particular decision by replaying the graph traversal.

## The Self-Improvement Loop

Here's where it gets interesting. After interactions, surrogates run **debriefs**:

1. The debrief engine analyzes the interaction against the SOP graph
2. It identifies nodes where the surrogate struggled, took suboptimal paths, or hit escalation unnecessarily
3. It generates **SOP modification proposals** -- specific changes to nodes, edges, or thresholds
4. A human reviews and approves (or rejects) the proposals
5. Approved changes create a **new SOP version** (the old one is preserved)

```
Interaction -> Debrief -> Proposal -> Human Review -> New SOP Version
     ^                                                       |
     |_______________________________________________________|
```

SOPs are signed with Ed25519 keys. Every version is immutable and auditable. You always have a complete chain of custody showing how a surrogate's decision-making evolved.

## Why This Matters

If you're building AI agents for toy use cases, black boxes are fine. If you're deploying AI in healthcare, finance, or legal -- you need:

- **Explainability.** Why did the AI make that decision? Walk the graph.
- **Auditability.** Every node execution is logged with context.
- **Control.** Humans approve SOP changes. Escalation paths are mandatory.
- **Versioning.** Roll back to any previous SOP version.

## Try It Out

Surrogate OS is open source (MIT). The SOP engine is one piece of a larger system that includes multi-tenant isolation, compliance frameworks (HIPAA, GDPR, EU AI Act), federated learning, and multi-interface deployment.

GitHub: [github.com/vishalm/surrogate-os](https://github.com/vishalm/surrogate-os)
Docs: [vishalm.github.io/surrogate-os](https://vishalm.github.io/surrogate-os/)

571 tests. 130+ API endpoints. Built with TypeScript, Fastify, Next.js, PostgreSQL + pgvector.

If you're thinking about auditable AI agents, I'd love to hear your approach. Star the repo if this is interesting to you.

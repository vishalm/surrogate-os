---
sidebar_position: 1
title: "Phase 1 — Studio"
description: "Core surrogate management, SOP generation, graph visualization, RBAC, and audit trail."
---

# Phase 1 — Studio

Phase 1 establishes the foundational platform: surrogate lifecycle management, LLM-powered SOP generation, role-based access control, and a tamper-evident audit trail.

---

## Surrogate CRUD

Surrogates are the core entity in Surrogate OS. Each surrogate represents a professional identity defined by:

- **Role title** (e.g., "Senior ER Nurse")
- **Domain** (e.g., "healthcare")
- **Jurisdiction** (e.g., "NHS_UK")
- **Status** (DRAFT, ACTIVE, ARCHIVED)
- **Config** (JSON object for persona-specific settings)

The surrogate lifecycle:

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Create
    DRAFT --> ACTIVE: Activate
    ACTIVE --> ARCHIVED: Archive
    ARCHIVED --> ACTIVE: Reactivate
    ACTIVE --> DRAFT: Revise
```

Endpoints: `POST/GET/PATCH/DELETE /api/v1/surrogates`

---

## SOP Generation via LLM

SOPs (Standard Operating Procedures) are structured as directed graphs, not flat documents. Each SOP contains:

- **Nodes**: Steps, decisions, escalation points
- **Edges**: Transitions between nodes with conditions
- **Metadata**: Version, hash, certification status

### Generation Flow

```mermaid
sequenceDiagram
    participant User
    participant API as /llm/generate-sop
    participant LLM as LLM Provider
    participant DB as Tenant Schema

    User->>API: POST { surrogateId, additionalContext }
    API->>DB: Fetch surrogate details
    API->>LLM: Generate SOP graph (role + domain + jurisdiction)
    LLM-->>API: Structured SOP graph JSON
    API->>DB: Store SOP with hash
    API->>DB: Create audit entry
    API-->>User: SOP with graph structure
```

### Supported LLM Providers

Configured per-organization in org settings:

| Provider | Model Examples | Config Required |
|----------|--------------|-----------------|
| **Anthropic Claude** | claude-sonnet-4-20250514 | `ANTHROPIC_API_KEY` |
| **OpenAI** | gpt-4o | `OPENAI_API_KEY` |
| **Ollama** | llama3, mistral | `OLLAMA_ENDPOINT` (local) |

---

## SOP Graph Visualization

SOPs are stored as JSON graph structures with nodes and edges. The web dashboard renders these as interactive directed graphs, showing:

- Step sequence and branching logic
- Decision points with condition labels
- Escalation triggers
- Compliance checkpoints

SOPs support versioning: each update creates a new version linked to the previous via `previous_version_id`, with a content hash for integrity verification.

---

## Role-Based Access Control

Three roles with increasing privileges:

| Role | Capabilities |
|------|-------------|
| **MEMBER** | Read all data, create surrogates/SOPs, generate SOPs, create audit entries |
| **ADMIN** | All MEMBER permissions + invite users, update org settings, manage API keys/webhooks, approve proposals, remove members |
| **OWNER** | All ADMIN permissions + federation opt-in/out, delete org resources |

RBAC is enforced via the `requireRole()` middleware applied at the route level.

---

## Audit Log with Hash-Chaining

Every significant action produces an audit entry stored in the tenant schema. Entries form a cryptographic chain:

```mermaid
graph LR
    E1["Entry 1<br/>hash: abc123<br/>prev: null"] --> E2["Entry 2<br/>hash: def456<br/>prev: abc123"]
    E2 --> E3["Entry 3<br/>hash: ghi789<br/>prev: def456"]
    E3 --> E4["Entry 4<br/>hash: jkl012<br/>prev: ghi789"]

    style E1 fill:#4f46e5,color:#fff,stroke:none
    style E2 fill:#4f46e5,color:#fff,stroke:none
    style E3 fill:#4f46e5,color:#fff,stroke:none
    style E4 fill:#4f46e5,color:#fff,stroke:none
```

Each audit entry records:
- **Action** performed
- **Surrogate ID** (if applicable)
- **User ID** who performed it
- **Details** (JSON payload)
- **Rationale** and **confidence** score
- **Human auth** flags (required/granted)
- **Hash** of current entry and **previous_hash** for chain integrity

The chain can be verified via `GET /api/v1/audit/:id/verify` which walks the chain and confirms no entries have been tampered with.

---

## Key API Endpoints (Phase 1)

| Module | Endpoints | Count |
|--------|-----------|-------|
| Auth | register, login, refresh, invite | 4 |
| Orgs | get/update org, members, settings | 6 |
| Surrogates | CRUD + list | 5 |
| SOPs | CRUD + versions + status transitions | 5 |
| LLM | providers, generate-sop | 2 |
| Audit | create, list, verify chain | 3 |
| Stats | dashboard stats | 1 |

---

*Next: [Phase 2 — Persona Engine](/docs/features/phase2-persona)*

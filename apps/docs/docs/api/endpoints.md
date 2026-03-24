---
sidebar_position: 1
title: "API Endpoints"
description: "Complete REST API reference for all 21 route modules."
---

# API Endpoints

Base URL: `http://localhost:3001/api/v1`

All endpoints require `Authorization: Bearer {token}` unless marked as **Public**. Responses use a consistent envelope:

```json
{ "success": true, "data": { ... }, "error": null }
```

Interactive Swagger docs are available at `http://localhost:3001/docs` when running locally.

---

## Auth

Prefix: `/api/v1/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/register` | Public | Register new user + organization |
| `POST` | `/login` | Public | Login with email/password, returns JWT tokens |
| `POST` | `/refresh` | Public | Refresh access token using refresh token |
| `POST` | `/invite` | OWNER/ADMIN | Invite a member to the organization |

---

## Organizations

Prefix: `/api/v1/orgs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/me` | Authenticated | Get current user's organization |
| `PATCH` | `/me` | OWNER/ADMIN | Update organization details |
| `GET` | `/me/members` | Authenticated | List organization members |
| `GET` | `/me/settings` | OWNER/ADMIN | Get org settings (API keys masked) |
| `PATCH` | `/me/settings` | OWNER/ADMIN | Update org settings (LLM provider, etc.) |
| `DELETE` | `/me/members/:id` | OWNER/ADMIN | Remove a member from the org |

---

## Surrogates

Prefix: `/api/v1/surrogates`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/` | Authenticated | Create a new surrogate |
| `GET` | `/` | Authenticated | List surrogates (paginated) |
| `GET` | `/:id` | Authenticated | Get surrogate by ID |
| `PATCH` | `/:id` | Authenticated | Update surrogate |
| `DELETE` | `/:id` | Authenticated | Soft-delete surrogate |

---

## SOPs

Prefix: `/api/v1/sops`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Authenticated | List SOPs (filter by surrogateId, status) |
| `GET` | `/:id` | Authenticated | Get SOP by ID (includes graph) |
| `POST` | `/` | Authenticated | Create a new SOP |
| `POST` | `/:sopId/versions` | Authenticated | Create a new version of an SOP |
| `PATCH` | `/:id/status` | Authenticated | Transition SOP status (DRAFT/ACTIVE/ARCHIVED) |

---

## LLM

Prefix: `/api/v1/llm`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/providers` | Authenticated | List available LLM providers and config |
| `POST` | `/generate-sop` | Authenticated | Generate SOP via configured LLM provider |

---

## Audit

Prefix: `/api/v1/audit`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/` | Authenticated | Create an audit entry |
| `GET` | `/` | Authenticated | List audit entries (filter by surrogateId, action, dates) |
| `GET` | `/:id/verify` | Authenticated | Verify audit chain integrity from entry ID |

---

## Stats

Prefix: `/api/v1/stats`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/dashboard` | Authenticated | Get dashboard statistics |

---

## Org DNA

Prefix: `/api/v1/org-dna`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/documents` | Authenticated | Upload an organizational document |
| `GET` | `/documents` | Authenticated | List documents (paginated) |
| `GET` | `/documents/:id` | Authenticated | Get document by ID |
| `DELETE` | `/documents/:id` | OWNER/ADMIN | Delete a document |
| `POST` | `/search` | Authenticated | Semantic search across document chunks |

---

## Memory

Prefix: `/api/v1/memory`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Authenticated | List memory entries (filter by surrogateId, type, tags) |
| `GET` | `/:id` | Authenticated | Get memory entry by ID |
| `POST` | `/` | Authenticated | Create a memory entry (STM or LTM) |
| `PATCH` | `/:id/promote` | OWNER/ADMIN | Promote STM entry to LTM |
| `DELETE` | `/:id` | OWNER/ADMIN | Archive a memory entry |
| `POST` | `/detect-patterns` | Authenticated | Run pattern detection on a surrogate's memories |
| `POST` | `/cleanup` | OWNER/ADMIN | Cleanup expired STM entries |

---

## Debriefs

Prefix: `/api/v1/debriefs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Authenticated | List all debriefs (paginated) |
| `GET` | `/analytics` | Authenticated | Get debrief analytics |
| `POST` | `/sessions` | Authenticated | Start a new session |
| `GET` | `/sessions` | Authenticated | List sessions (filter by surrogateId, status) |
| `GET` | `/sessions/:sessionId` | Authenticated | Get session detail |
| `POST` | `/sessions/:sessionId/decisions` | Authenticated | Record a decision outcome |
| `PATCH` | `/sessions/:sessionId/complete` | Authenticated | Complete a session |
| `POST` | `/sessions/:sessionId/generate` | Authenticated | Generate debrief from session data |
| `GET` | `/sessions/:sessionId/debrief` | Authenticated | Get debrief for a session |

---

## Proposals

Prefix: `/api/v1/proposals`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/` | Authenticated | Create a manual SOP proposal |
| `POST` | `/from-debrief` | Authenticated | Create proposal from debrief analysis |
| `GET` | `/` | Authenticated | List proposals (filter by sopId, status) |
| `GET` | `/:id` | Authenticated | Get proposal detail |
| `PATCH` | `/:id/review` | OWNER/ADMIN | Approve or reject a proposal |

---

## Fleet

Prefix: `/api/v1/fleet`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/status` | Authenticated | Fleet-wide status overview |
| `GET` | `/surrogates` | Authenticated | Enriched surrogates list with health data |
| `GET` | `/surrogates/:id/health` | Authenticated | Individual surrogate health metrics |
| `GET` | `/analytics` | Authenticated | Fleet-wide analytics |
| `GET` | `/sessions/active` | Authenticated | List active sessions across fleet |

---

## Handoffs

Prefix: `/api/v1/handoffs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/` | Authenticated | Initiate a handoff (D2D, D2H, or H2D) |
| `POST` | `/:id/accept` | Authenticated | Accept an incoming handoff |
| `POST` | `/:id/reject` | Authenticated | Reject an incoming handoff |
| `GET` | `/` | Authenticated | List handoffs (filter by status, type, surrogateId) |
| `GET` | `/:id` | Authenticated | Get handoff detail |

---

## Personas

Prefix: `/api/v1/personas`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/` | Authenticated | Create persona template |
| `GET` | `/` | Authenticated | List persona templates (filter by domain, category, tags) |
| `GET` | `/:id` | Authenticated | Get persona template with versions |
| `PATCH` | `/:id` | Authenticated | Update persona template (creates new version) |
| `POST` | `/:id/rollback` | Authenticated | Rollback to a specific version |
| `POST` | `/:id/instantiate` | Authenticated | Create surrogate from persona template |
| `GET` | `/:id/export` | Authenticated | Export persona template as JSON |
| `POST` | `/import` | Authenticated | Import persona template from JSON |
| `DELETE` | `/:id` | OWNER/ADMIN | Soft-delete persona template |

---

## Marketplace

Prefix: `/api/v1/marketplace`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/publish` | Authenticated | Publish an SOP to the marketplace |
| `GET` | `/` | Authenticated | Browse marketplace (filter by domain, category, rating) |
| `GET` | `/:id` | Authenticated | Get listing detail |
| `POST` | `/:id/install` | Authenticated | Install a marketplace SOP into your org |
| `POST` | `/:id/reviews` | Authenticated | Add a review |
| `GET` | `/:id/reviews` | Authenticated | List reviews for a listing |
| `PATCH` | `/:id` | Authenticated | Update listing (owner org only) |
| `DELETE` | `/:id` | Authenticated | Remove listing (owner org only) |

---

## Bias

Prefix: `/api/v1/bias`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/check` | Authenticated | Trigger a bias check on a surrogate |
| `GET` | `/checks` | Authenticated | List bias checks (paginated) |
| `GET` | `/checks/:id` | Authenticated | Get bias check detail |
| `GET` | `/distribution` | Authenticated | Get decision distribution analysis |
| `GET` | `/anomalies` | Authenticated | Get recent anomalies |
| `GET` | `/dashboard` | Authenticated | Aggregated bias dashboard data |

---

## Humanoid

Prefix: `/api/v1/humanoid`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/devices` | Authenticated | Register a humanoid device |
| `GET` | `/devices` | Authenticated | List devices (filter by status, modality) |
| `GET` | `/devices/:id` | Authenticated | Get device detail |
| `PATCH` | `/devices/:id/status` | Authenticated | Update device status |
| `POST` | `/devices/:id/kill-switch` | OWNER/ADMIN | Trigger kill switch (SOFT_PAUSE/FULL_STOP/EMERGENCY_KILL) |
| `POST` | `/translate/:sopId/:deviceId` | Authenticated | Translate SOP for specific device modality |
| `GET` | `/devices/:id/health` | Authenticated | Device health metrics |

---

## Federation

Prefix: `/api/v1/federation`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/contribute` | Authenticated | Submit anonymized decision data |
| `GET` | `/contributions` | Authenticated | List org's contributions |
| `GET` | `/insights` | Authenticated | Get federated pool insights |
| `POST` | `/apply/:sopId` | Authenticated | Apply federated insights to an SOP |
| `GET` | `/privacy-report` | Authenticated | Privacy budget report |
| `PATCH` | `/participation` | OWNER | Opt in/out of federation |
| `GET` | `/leaderboard` | Authenticated | Contribution leaderboard |

---

## Compliance

Prefix: `/api/v1/compliance`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/check/:surrogateId` | Authenticated | Run compliance check against a framework |
| `GET` | `/frameworks` | Authenticated | List available regulatory frameworks |
| `GET` | `/frameworks/:id` | Authenticated | Get framework detail and rules |
| `POST` | `/sign/:sopId` | OWNER/ADMIN | Cryptographically sign an SOP (Ed25519) |
| `GET` | `/verify/:sopId` | Authenticated | Verify SOP signatures |
| `GET` | `/history/:surrogateId` | Authenticated | Compliance check history |
| `GET` | `/status/:surrogateId` | Authenticated | Current certification status |
| `POST` | `/report/:surrogateId` | Authenticated | Generate compliance report |

---

## Executions

Prefix: `/api/v1/executions`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/start` | Authenticated | Start a new SOP execution |
| `POST` | `/:id/advance` | Authenticated | Advance execution to next graph node |
| `PATCH` | `/:id/pause` | Authenticated | Pause a running execution |
| `PATCH` | `/:id/resume` | Authenticated | Resume a paused execution |
| `POST` | `/:id/abort` | Authenticated | Abort an execution with reason |
| `POST` | `/:id/escalate` | Authenticated | Trigger human escalation |
| `GET` | `/:id` | Authenticated | Get execution state |
| `GET` | `/` | Authenticated | List executions (filter by status, surrogateId) |
| `GET` | `/:id/timeline` | Authenticated | Decision timeline for an execution |
| `GET` | `/:id/transitions` | Authenticated | Available transitions from current node |

---

## API Keys

Prefix: `/api/v1/api-keys`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/` | OWNER/ADMIN | Create a new API key |
| `GET` | `/` | OWNER/ADMIN | List API keys |
| `DELETE` | `/:id` | OWNER/ADMIN | Revoke an API key |
| `POST` | `/:id/rotate` | OWNER/ADMIN | Rotate an API key |

---

## Webhooks

Prefix: `/api/v1/webhooks`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/` | OWNER/ADMIN | Register a webhook |
| `GET` | `/` | OWNER/ADMIN | List webhooks |
| `PATCH` | `/:id` | OWNER/ADMIN | Update webhook (URL, events, active) |
| `DELETE` | `/:id` | OWNER/ADMIN | Delete webhook |
| `GET` | `/:id/deliveries` | OWNER/ADMIN | View delivery log |
| `POST` | `/:id/test` | OWNER/ADMIN | Send test webhook |

---

## Notifications

Prefix: `/api/v1/notifications`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Authenticated | List notifications (filter by unreadOnly) |
| `GET` | `/unread-count` | Authenticated | Get unread notification count |
| `PATCH` | `/:id/read` | Authenticated | Mark notification as read |
| `PATCH` | `/read-all` | Authenticated | Mark all notifications as read |

---

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SURROGATE_NOT_FOUND",
    "message": "Surrogate with ID ... does not exist",
    "statusCode": 404
  }
}
```

| Status | Meaning |
|--------|---------|
| `400` | Validation error |
| `401` | Authentication required |
| `403` | Insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict (duplicate) |
| `429` | Rate limited (100 req/min) |
| `500` | Internal error |

---
sidebar_position: 5
title: "API Reference"
description: "REST API endpoints for surrogate generation, querying, fleet management, and audit trail access."
---

# API Reference

The Surrogate OS API is a REST API served by Fastify on port `3001`.

All endpoints require `Authorization: Bearer {token}` unless noted.

---

## Authentication

### Register

```http
POST /v1/auth/register

{
  "email": "nurse.director@nhs.uk",
  "password": "secure-password",
  "name": "Dr. Sarah Wilson",
  "orgName": "Royal London Hospital"
}
```

### Login

```http
POST /v1/auth/login

{
  "email": "nurse.director@nhs.uk",
  "password": "secure-password"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "expiresIn": 900
}
```

---

## Surrogates

### Generate Surrogate

```http
POST /v1/surrogates/generate
Authorization: Bearer {token}

{
  "role": "Senior ER Nurse",
  "jurisdiction": "NHS_UK",
  "organization": {
    "name": "Royal London Hospital",
    "type": "NHS Trust"
  }
}
```

**Response:**
```json
{
  "surrogateId": "sg_f8a2b1c9",
  "status": "ready",
  "sopCount": 147,
  "complianceScore": 99.8,
  "deploymentToken": "dt_..."
}
```

### Query Surrogate

```http
POST /v1/surrogates/{id}/query
Authorization: Bearer {token}

{
  "message": "Patient: chest pain, diaphoresis, shortness of breath",
  "context": { "ward": "A&E", "patientId": "P-001234" }
}
```

**Response:**
```json
{
  "response": "...",
  "confidence": 0.974,
  "sopReference": "SOP-010: Patient Triage",
  "humanAuthRequired": false,
  "auditId": "aud_7f3c9a12"
}
```

### List Surrogates

```http
GET /v1/surrogates?page=1&limit=20
Authorization: Bearer {token}
```

### Get Surrogate

```http
GET /v1/surrogates/{id}
Authorization: Bearer {token}
```

### Update Surrogate

```http
PATCH /v1/surrogates/{id}
Authorization: Bearer {token}

{
  "name": "Updated Clinical Aide",
  "status": "active"
}
```

---

## SOPs

### List SOPs for Surrogate

```http
GET /v1/surrogates/{id}/sops
Authorization: Bearer {token}
```

### Get SOP Detail

```http
GET /v1/sops/{sopId}
Authorization: Bearer {token}
```

**Response includes:** Steps, escalation tree, compliance references, certification status.

---

## Fleet Status

```http
GET /v1/fleet/status
Authorization: Bearer {token}
```

**Response:**
```json
{
  "activeSurrogates": 12,
  "currentTasks": 7,
  "pendingEscalations": 1,
  "biasAlerts": 0,
  "uptime": "99.97%"
}
```

---

## Audit Trail

### Get Audit Entries

```http
GET /v1/audit?surrogateId={id}&from={iso}&to={iso}&page=1
Authorization: Bearer {token}
```

### Get Single Audit Entry

```http
GET /v1/audit/{auditId}
Authorization: Bearer {token}
```

### Verify Audit Chain

```http
POST /v1/audit/verify
Authorization: Bearer {token}

{
  "surrogateId": "sg_f8a2b1c9",
  "from": "2025-06-01T00:00:00Z",
  "to": "2025-06-30T23:59:59Z"
}
```

**Response:**
```json
{
  "verified": true,
  "entriesChecked": 14832,
  "chainIntact": true,
  "firstEntry": "aud_a1b2c3d4",
  "lastEntry": "aud_z9y8x7w6"
}
```

---

## Organizations

### Get Current Organization

```http
GET /v1/orgs/current
Authorization: Bearer {token}
```

### Update Organization

```http
PATCH /v1/orgs/current
Authorization: Bearer {token}

{
  "name": "Royal London Hospital Trust",
  "plan": "ENTERPRISE"
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "SURROGATE_NOT_FOUND",
    "message": "Surrogate with ID sg_invalid does not exist",
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
| `409` | Conflict (duplicate, etc.) |
| `429` | Rate limited |
| `500` | Internal error |

---

*Interactive API documentation available at `http://localhost:3001/docs` when running locally (Swagger/OpenAPI).*

---
sidebar_position: 3
title: "Configuration"
description: "Environment variables, safety settings, and deployment configuration for Surrogate OS."
---

# Configuration

Surrogate OS is configured through environment variables and a typed configuration file.

## Environment Variables

### API Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `DATABASE_URL` | `postgresql://surrogate:surrogate_dev@localhost:5432/surrogate_os` | PostgreSQL connection |
| `JWT_SECRET` | `surrogate-dev-secret-change-in-prod` | JWT signing secret |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token TTL |
| `OTEL_ENDPOINT` | `http://localhost:4318` | OpenTelemetry collector |
| `LOG_LEVEL` | `info` | Logging level |
| `NODE_ENV` | `development` | Environment |

---

## Safety Configuration

Safety settings are architectural constraints. Several **cannot** be disabled regardless of configuration.

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
    killSwitchEnabled: true,          // ⚠️ CANNOT be set to false
    auditLevel: 'FULL',
    biasMonitoring: true,             // ⚠️ CANNOT be disabled for welfare roles
    identityIntegrityLock: true       // ⚠️ CANNOT be disabled
  },

  interfaces: {
    chat:  { enabled: true,  port: 3000 },
    voice: { enabled: false, provider: 'twilio' },
    api:   { enabled: true,  port: 8080 },
    humanoid: {
      enabled: false,                 // Phase 4 feature
      platform: 'figure-01',
      physicalAuthRequired: true,     // ⚠️ CANNOT be set to false
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

### Immutable Constraints

These are enforced in code and **cannot be overridden** by any config, prompt, or API call:

```typescript
const IMMUTABLE_CONSTRAINTS = {
  AI_IDENTITY_DISCLOSURE:          'ALWAYS',
  HUMAN_OVERRIDE_POSSIBLE:         'ALWAYS',
  AUDIT_LOG_IMMUTABLE:             true,
  KILL_SWITCH_ACTIVE:              'ALWAYS',
  PHYSICAL_AUTH_FOR_HUMAN_CONTACT: 'ALWAYS',
  PERSONA_MID_OP_SWITCH:           'BLOCKED',
  MAX_AUTONOMOUS_RISK_LEVEL:       2    // L3+ always requires human auth
} as const;
```

---

## Multi-Tenant Configuration

Each organization gets its own PostgreSQL schema. Tenant routing is handled automatically:

```typescript
// Per-org encryption (BYOK)
const tenantConfig = {
  orgId: 'org_nhs_trust_001',
  schema: 'tenant_nhs_trust_001',
  encryptionKey: 'customer-provided-key',  // Org holds, not us
  vectorDbNamespace: 'nhs_trust_001',
  dataResidency: 'UK'
};
```

---

## Testing

```bash
npm test                  # Full test suite
npm run test:unit         # Unit tests
npm run test:safety       # Required before production deployment
npm run test:validation   # Domain expert validation
```

### Safety Test Coverage Requirements

| Category | Required | Status |
|----------|----------|--------|
| Kill switch response | 100% | ✅ |
| Human auth enforcement | 100% | ✅ |
| Identity disclosure | 100% | ✅ |
| SOP compliance | >95% | ✅ |
| Bias detection triggers | >90% | ✅ |
| Escalation accuracy | >95% | 🔄 In Progress |
| Physical hard stop | 100% | 📋 Phase 4 |

import { describe, it, expect } from 'vitest';
import {
  createOrgSchema,
  loginSchema,
  createSurrogateSchema,
  createAuditEntrySchema,
  paginationSchema,
} from './index.js';
import { AuditAction, OrgPlan } from '../constants/index.js';

describe('createOrgSchema', () => {
  it('accepts valid input', () => {
    const result = createOrgSchema.parse({
      name: 'My Organization',
      slug: 'my-org',
    });
    expect(result.name).toBe('My Organization');
    expect(result.slug).toBe('my-org');
    expect(result.plan).toBe(OrgPlan.STUDIO); // default
  });

  it('accepts a valid slug with numbers and hyphens', () => {
    const result = createOrgSchema.parse({
      name: 'Test',
      slug: 'org-123-test',
    });
    expect(result.slug).toBe('org-123-test');
  });

  it('accepts a custom plan', () => {
    const result = createOrgSchema.parse({
      name: 'Enterprise Corp',
      slug: 'enterprise-corp',
      plan: OrgPlan.ENTERPRISE,
    });
    expect(result.plan).toBe(OrgPlan.ENTERPRISE);
  });

  it('rejects slugs with uppercase letters', () => {
    expect(() =>
      createOrgSchema.parse({ name: 'Test', slug: 'MyOrg' }),
    ).toThrow();
  });

  it('rejects slugs with spaces', () => {
    expect(() =>
      createOrgSchema.parse({ name: 'Test', slug: 'my org' }),
    ).toThrow();
  });

  it('rejects slugs shorter than 3 characters', () => {
    expect(() =>
      createOrgSchema.parse({ name: 'Test', slug: 'ab' }),
    ).toThrow();
  });

  it('rejects slugs longer than 50 characters', () => {
    const longSlug = 'a'.repeat(51);
    expect(() =>
      createOrgSchema.parse({ name: 'Test', slug: longSlug }),
    ).toThrow();
  });

  it('rejects slugs starting with a hyphen', () => {
    expect(() =>
      createOrgSchema.parse({ name: 'Test', slug: '-my-org' }),
    ).toThrow();
  });

  it('rejects slugs ending with a hyphen', () => {
    expect(() =>
      createOrgSchema.parse({ name: 'Test', slug: 'my-org-' }),
    ).toThrow();
  });

  it('rejects empty name', () => {
    expect(() =>
      createOrgSchema.parse({ name: '', slug: 'valid-slug' }),
    ).toThrow();
  });
});

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.parse({
      email: 'user@example.com',
      password: 'secret',
    });
    expect(result.email).toBe('user@example.com');
    expect(result.password).toBe('secret');
  });

  it('rejects missing email', () => {
    expect(() => loginSchema.parse({ password: 'secret' })).toThrow();
  });

  it('rejects invalid email format', () => {
    expect(() =>
      loginSchema.parse({ email: 'not-an-email', password: 'secret' }),
    ).toThrow();
  });

  it('rejects empty password', () => {
    expect(() =>
      loginSchema.parse({ email: 'user@example.com', password: '' }),
    ).toThrow();
  });

  it('rejects missing password', () => {
    expect(() =>
      loginSchema.parse({ email: 'user@example.com' }),
    ).toThrow();
  });
});

describe('createSurrogateSchema', () => {
  const validInput = {
    roleTitle: 'Customer Support Agent',
    domain: 'Healthcare',
    jurisdiction: 'US-CA',
  };

  it('accepts valid input without config', () => {
    const result = createSurrogateSchema.parse(validInput);
    expect(result.roleTitle).toBe('Customer Support Agent');
    expect(result.domain).toBe('Healthcare');
    expect(result.jurisdiction).toBe('US-CA');
  });

  it('accepts valid input with partial config', () => {
    const result = createSurrogateSchema.parse({
      ...validInput,
      config: { seniority: 'senior', assertiveness: 7 },
    });
    expect(result.config).toEqual({ seniority: 'senior', assertiveness: 7 });
  });

  it('rejects missing roleTitle', () => {
    expect(() =>
      createSurrogateSchema.parse({ domain: 'Healthcare', jurisdiction: 'US' }),
    ).toThrow();
  });

  it('rejects missing domain', () => {
    expect(() =>
      createSurrogateSchema.parse({ roleTitle: 'Agent', jurisdiction: 'US' }),
    ).toThrow();
  });

  it('rejects missing jurisdiction', () => {
    expect(() =>
      createSurrogateSchema.parse({ roleTitle: 'Agent', domain: 'Healthcare' }),
    ).toThrow();
  });

  it('rejects empty roleTitle', () => {
    expect(() =>
      createSurrogateSchema.parse({ ...validInput, roleTitle: '' }),
    ).toThrow();
  });

  it('rejects roleTitle exceeding 200 characters', () => {
    expect(() =>
      createSurrogateSchema.parse({ ...validInput, roleTitle: 'x'.repeat(201) }),
    ).toThrow();
  });

  it('config defaults to undefined when omitted', () => {
    const result = createSurrogateSchema.parse(validInput);
    expect(result.config).toBeUndefined();
  });
});

describe('createAuditEntrySchema', () => {
  const validInput = {
    action: AuditAction.DECISION_MADE,
    humanAuthRequired: false,
  };

  it('accepts valid input', () => {
    const result = createAuditEntrySchema.parse(validInput);
    expect(result.action).toBe(AuditAction.DECISION_MADE);
    expect(result.humanAuthRequired).toBe(false);
    expect(result.details).toEqual({}); // default
  });

  it('accepts confidence between 0 and 1', () => {
    const result = createAuditEntrySchema.parse({
      ...validInput,
      confidence: 0.85,
    });
    expect(result.confidence).toBe(0.85);
  });

  it('accepts confidence of 0', () => {
    const result = createAuditEntrySchema.parse({
      ...validInput,
      confidence: 0,
    });
    expect(result.confidence).toBe(0);
  });

  it('accepts confidence of 1', () => {
    const result = createAuditEntrySchema.parse({
      ...validInput,
      confidence: 1,
    });
    expect(result.confidence).toBe(1);
  });

  it('rejects confidence greater than 1', () => {
    expect(() =>
      createAuditEntrySchema.parse({ ...validInput, confidence: 1.5 }),
    ).toThrow();
  });

  it('rejects confidence less than 0', () => {
    expect(() =>
      createAuditEntrySchema.parse({ ...validInput, confidence: -0.1 }),
    ).toThrow();
  });

  it('rejects invalid action enum value', () => {
    expect(() =>
      createAuditEntrySchema.parse({
        ...validInput,
        action: 'INVALID_ACTION',
      }),
    ).toThrow();
  });

  it('accepts optional surrogateId', () => {
    const result = createAuditEntrySchema.parse({
      ...validInput,
      surrogateId: 'surr-123',
    });
    expect(result.surrogateId).toBe('surr-123');
  });

  it('accepts optional rationale', () => {
    const result = createAuditEntrySchema.parse({
      ...validInput,
      rationale: 'Because of policy X',
    });
    expect(result.rationale).toBe('Because of policy X');
  });

  it('rejects missing humanAuthRequired', () => {
    expect(() =>
      createAuditEntrySchema.parse({ action: AuditAction.USER_LOGIN }),
    ).toThrow();
  });
});

describe('paginationSchema', () => {
  it('applies defaults for page and pageSize', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('accepts custom values', () => {
    const result = paginationSchema.parse({ page: 5, pageSize: 50 });
    expect(result.page).toBe(5);
    expect(result.pageSize).toBe(50);
  });

  it('coerces string values to numbers', () => {
    const result = paginationSchema.parse({ page: '3', pageSize: '15' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(15);
  });

  it('rejects page less than 1', () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });

  it('rejects pageSize greater than 100', () => {
    expect(() => paginationSchema.parse({ pageSize: 101 })).toThrow();
  });

  it('rejects pageSize less than 1', () => {
    expect(() => paginationSchema.parse({ pageSize: 0 })).toThrow();
  });

  it('rejects non-integer page', () => {
    expect(() => paginationSchema.parse({ page: 1.5 })).toThrow();
  });
});

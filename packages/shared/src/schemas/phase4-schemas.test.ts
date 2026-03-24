import { describe, it, expect } from 'vitest';
import {
  startExecutionSchema,
  advanceExecutionSchema,
  abortExecutionSchema,
  escalateExecutionSchema,
  createFederationContributionSchema,
  updateFederationParticipationSchema,
  federationInsightsQuerySchema,
  applyFederationInsightsSchema,
} from './index.js';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const validUUID2 = '660e8400-e29b-41d4-a716-446655440001';

// ---------------------------------------------------------------------------
// startExecutionSchema
// ---------------------------------------------------------------------------

describe('startExecutionSchema', () => {
  it('accepts valid input with surrogateId and sopId', () => {
    const result = startExecutionSchema.parse({
      surrogateId: validUUID,
      sopId: validUUID2,
    });
    expect(result.surrogateId).toBe(validUUID);
    expect(result.sopId).toBe(validUUID2);
  });

  it('rejects missing surrogateId', () => {
    expect(() => startExecutionSchema.parse({ sopId: validUUID })).toThrow();
  });

  it('rejects missing sopId', () => {
    expect(() => startExecutionSchema.parse({ surrogateId: validUUID })).toThrow();
  });

  it('rejects empty object', () => {
    expect(() => startExecutionSchema.parse({})).toThrow();
  });

  it('rejects invalid UUID for surrogateId', () => {
    expect(() =>
      startExecutionSchema.parse({ surrogateId: 'not-a-uuid', sopId: validUUID }),
    ).toThrow();
  });

  it('rejects invalid UUID for sopId', () => {
    expect(() =>
      startExecutionSchema.parse({ surrogateId: validUUID, sopId: 'bad-uuid' }),
    ).toThrow();
  });

  it('rejects non-string surrogateId', () => {
    expect(() =>
      startExecutionSchema.parse({ surrogateId: 123, sopId: validUUID }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// advanceExecutionSchema
// ---------------------------------------------------------------------------

describe('advanceExecutionSchema', () => {
  const validInput = {
    decision: 'approve',
    edgeId: 'edge-1',
  };

  it('accepts valid input with required fields only', () => {
    const result = advanceExecutionSchema.parse(validInput);
    expect(result.decision).toBe('approve');
    expect(result.edgeId).toBe('edge-1');
    expect(result.confidence).toBe(1.0); // default
  });

  it('accepts valid input with all optional fields', () => {
    const result = advanceExecutionSchema.parse({
      ...validInput,
      input: { patientId: 'p1', severity: 'high' },
      confidence: 0.85,
    });
    expect(result.input).toEqual({ patientId: 'p1', severity: 'high' });
    expect(result.confidence).toBe(0.85);
  });

  it('rejects missing decision', () => {
    expect(() => advanceExecutionSchema.parse({ edgeId: 'edge-1' })).toThrow();
  });

  it('rejects missing edgeId', () => {
    expect(() => advanceExecutionSchema.parse({ decision: 'approve' })).toThrow();
  });

  it('rejects empty decision string', () => {
    expect(() =>
      advanceExecutionSchema.parse({ decision: '', edgeId: 'edge-1' }),
    ).toThrow();
  });

  it('rejects empty edgeId string', () => {
    expect(() =>
      advanceExecutionSchema.parse({ decision: 'approve', edgeId: '' }),
    ).toThrow();
  });

  it('rejects confidence below 0', () => {
    expect(() =>
      advanceExecutionSchema.parse({ ...validInput, confidence: -0.1 }),
    ).toThrow();
  });

  it('rejects confidence above 1', () => {
    expect(() =>
      advanceExecutionSchema.parse({ ...validInput, confidence: 1.1 }),
    ).toThrow();
  });

  it('accepts confidence of exactly 0', () => {
    const result = advanceExecutionSchema.parse({ ...validInput, confidence: 0 });
    expect(result.confidence).toBe(0);
  });

  it('accepts confidence of exactly 1', () => {
    const result = advanceExecutionSchema.parse({ ...validInput, confidence: 1 });
    expect(result.confidence).toBe(1);
  });

  it('defaults confidence to 1.0 when not provided', () => {
    const result = advanceExecutionSchema.parse(validInput);
    expect(result.confidence).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// abortExecutionSchema
// ---------------------------------------------------------------------------

describe('abortExecutionSchema', () => {
  it('accepts valid input with reason', () => {
    const result = abortExecutionSchema.parse({ reason: 'Patient declined' });
    expect(result.reason).toBe('Patient declined');
  });

  it('rejects missing reason', () => {
    expect(() => abortExecutionSchema.parse({})).toThrow();
  });

  it('rejects empty reason string', () => {
    expect(() => abortExecutionSchema.parse({ reason: '' })).toThrow();
  });

  it('rejects non-string reason', () => {
    expect(() => abortExecutionSchema.parse({ reason: 42 })).toThrow();
  });

  it('accepts long reason strings', () => {
    const longReason = 'A'.repeat(1000);
    const result = abortExecutionSchema.parse({ reason: longReason });
    expect(result.reason).toBe(longReason);
  });
});

// ---------------------------------------------------------------------------
// escalateExecutionSchema
// ---------------------------------------------------------------------------

describe('escalateExecutionSchema', () => {
  it('accepts valid input with reason', () => {
    const result = escalateExecutionSchema.parse({ reason: 'Requires senior approval' });
    expect(result.reason).toBe('Requires senior approval');
  });

  it('rejects missing reason', () => {
    expect(() => escalateExecutionSchema.parse({})).toThrow();
  });

  it('rejects empty reason string', () => {
    expect(() => escalateExecutionSchema.parse({ reason: '' })).toThrow();
  });

  it('rejects non-string reason', () => {
    expect(() => escalateExecutionSchema.parse({ reason: false })).toThrow();
  });

  it('accepts reason with special characters', () => {
    const result = escalateExecutionSchema.parse({
      reason: 'Risk score > 0.9 & patient history unclear (ref: #1234)',
    });
    expect(result.reason).toContain('Risk score');
  });
});

// ---------------------------------------------------------------------------
// createFederationContributionSchema
// ---------------------------------------------------------------------------

describe('createFederationContributionSchema', () => {
  const validInput = {
    domain: 'healthcare',
    decisionData: [{ decision: 'approve', confidence: 0.9 }],
  };

  it('accepts valid input with required fields', () => {
    const result = createFederationContributionSchema.parse(validInput);
    expect(result.domain).toBe('healthcare');
    expect(result.decisionData).toHaveLength(1);
    expect(result.epsilon).toBe(1.0); // default
  });

  it('accepts valid input with all optional fields', () => {
    const result = createFederationContributionSchema.parse({
      ...validInput,
      category: 'triage',
      epsilon: 2.5,
    });
    expect(result.category).toBe('triage');
    expect(result.epsilon).toBe(2.5);
  });

  it('rejects missing domain', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        decisionData: [{ x: 1 }],
      }),
    ).toThrow();
  });

  it('rejects empty domain string', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        domain: '',
        decisionData: [{ x: 1 }],
      }),
    ).toThrow();
  });

  it('rejects missing decisionData', () => {
    expect(() =>
      createFederationContributionSchema.parse({ domain: 'healthcare' }),
    ).toThrow();
  });

  it('rejects empty decisionData array', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        domain: 'healthcare',
        decisionData: [],
      }),
    ).toThrow();
  });

  it('rejects epsilon below minimum (0.01)', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        ...validInput,
        epsilon: 0.001,
      }),
    ).toThrow();
  });

  it('rejects epsilon above maximum (10)', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        ...validInput,
        epsilon: 11,
      }),
    ).toThrow();
  });

  it('accepts epsilon at minimum boundary (0.01)', () => {
    const result = createFederationContributionSchema.parse({
      ...validInput,
      epsilon: 0.01,
    });
    expect(result.epsilon).toBe(0.01);
  });

  it('accepts epsilon at maximum boundary (10)', () => {
    const result = createFederationContributionSchema.parse({
      ...validInput,
      epsilon: 10,
    });
    expect(result.epsilon).toBe(10);
  });

  it('accepts multiple decision data entries', () => {
    const result = createFederationContributionSchema.parse({
      ...validInput,
      decisionData: [
        { decision: 'a', confidence: 0.9 },
        { decision: 'b', confidence: 0.8 },
        { decision: 'c', confidence: 0.7 },
      ],
    });
    expect(result.decisionData).toHaveLength(3);
  });

  it('defaults epsilon to 1.0 when not provided', () => {
    const result = createFederationContributionSchema.parse(validInput);
    expect(result.epsilon).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// updateFederationParticipationSchema
// ---------------------------------------------------------------------------

describe('updateFederationParticipationSchema', () => {
  it('accepts valid opt-in', () => {
    const result = updateFederationParticipationSchema.parse({ optedIn: true });
    expect(result.optedIn).toBe(true);
  });

  it('accepts valid opt-out', () => {
    const result = updateFederationParticipationSchema.parse({ optedIn: false });
    expect(result.optedIn).toBe(false);
  });

  it('accepts optedIn with domains', () => {
    const result = updateFederationParticipationSchema.parse({
      optedIn: true,
      domains: ['healthcare', 'finance'],
    });
    expect(result.domains).toEqual(['healthcare', 'finance']);
  });

  it('rejects missing optedIn', () => {
    expect(() =>
      updateFederationParticipationSchema.parse({}),
    ).toThrow();
  });

  it('rejects non-boolean optedIn', () => {
    expect(() =>
      updateFederationParticipationSchema.parse({ optedIn: 'yes' }),
    ).toThrow();
  });

  it('rejects non-array domains', () => {
    expect(() =>
      updateFederationParticipationSchema.parse({ optedIn: true, domains: 'healthcare' }),
    ).toThrow();
  });

  it('accepts empty domains array', () => {
    const result = updateFederationParticipationSchema.parse({
      optedIn: true,
      domains: [],
    });
    expect(result.domains).toEqual([]);
  });

  it('accepts optedIn without domains (domains is optional)', () => {
    const result = updateFederationParticipationSchema.parse({ optedIn: true });
    expect(result.domains).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// federationInsightsQuerySchema
// ---------------------------------------------------------------------------

describe('federationInsightsQuerySchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = federationInsightsQuerySchema.parse({});
    expect(result.domain).toBeUndefined();
    expect(result.category).toBeUndefined();
  });

  it('accepts domain only', () => {
    const result = federationInsightsQuerySchema.parse({ domain: 'healthcare' });
    expect(result.domain).toBe('healthcare');
  });

  it('accepts category only', () => {
    const result = federationInsightsQuerySchema.parse({ category: 'triage' });
    expect(result.category).toBe('triage');
  });

  it('accepts both domain and category', () => {
    const result = federationInsightsQuerySchema.parse({
      domain: 'finance',
      category: 'risk-assessment',
    });
    expect(result.domain).toBe('finance');
    expect(result.category).toBe('risk-assessment');
  });

  it('rejects non-string domain', () => {
    expect(() =>
      federationInsightsQuerySchema.parse({ domain: 123 }),
    ).toThrow();
  });

  it('rejects non-string category', () => {
    expect(() =>
      federationInsightsQuerySchema.parse({ category: true }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// applyFederationInsightsSchema
// ---------------------------------------------------------------------------

describe('applyFederationInsightsSchema', () => {
  const validInput = {
    insights: [{ pattern: 'escalation_rate_high', recommendation: 'lower threshold' }],
  };

  it('accepts valid input with insights array', () => {
    const result = applyFederationInsightsSchema.parse(validInput);
    expect(result.insights).toHaveLength(1);
  });

  it('accepts valid input with rationale', () => {
    const result = applyFederationInsightsSchema.parse({
      ...validInput,
      rationale: 'Based on cross-org analysis',
    });
    expect(result.rationale).toBe('Based on cross-org analysis');
  });

  it('rejects missing insights', () => {
    expect(() => applyFederationInsightsSchema.parse({})).toThrow();
  });

  it('rejects empty insights array', () => {
    expect(() =>
      applyFederationInsightsSchema.parse({ insights: [] }),
    ).toThrow();
  });

  it('accepts multiple insights', () => {
    const result = applyFederationInsightsSchema.parse({
      insights: [
        { pattern: 'a' },
        { pattern: 'b' },
        { pattern: 'c' },
      ],
    });
    expect(result.insights).toHaveLength(3);
  });

  it('rationale is optional', () => {
    const result = applyFederationInsightsSchema.parse(validInput);
    expect(result.rationale).toBeUndefined();
  });

  it('rejects non-array insights', () => {
    expect(() =>
      applyFederationInsightsSchema.parse({ insights: 'not-an-array' }),
    ).toThrow();
  });
});

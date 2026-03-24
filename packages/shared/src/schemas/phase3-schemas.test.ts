import { describe, it, expect } from 'vitest';
import {
  startExecutionSchema,
  advanceExecutionSchema,
  abortExecutionSchema,
  escalateExecutionSchema,
  createHandoffSchema,
  acceptHandoffSchema,
  createPersonaTemplateSchema,
  updatePersonaTemplateSchema,
  publishMarketplaceListingSchema,
  installMarketplaceListingSchema,
  createMarketplaceReviewSchema,
  triggerBiasCheckSchema,
  createFederationContributionSchema,
  federationInsightsQuerySchema,
  applyFederationInsightsSchema,
  updateFederationParticipationSchema,
  fleetFilterSchema,
} from './index.js';
import { HandoffType } from '../constants/index.js';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const validUUID2 = '660e8400-e29b-41d4-a716-446655440001';

// --- Phase 4D: Execution Schemas ---

describe('startExecutionSchema', () => {
  it('accepts valid input', () => {
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

  it('rejects empty strings', () => {
    expect(() =>
      startExecutionSchema.parse({ surrogateId: '', sopId: '' }),
    ).toThrow();
  });
});

describe('advanceExecutionSchema', () => {
  const validInput = {
    decision: 'Proceed to next step',
    edgeId: 'edge-1',
    confidence: 0.95,
  };

  it('accepts valid input with required fields', () => {
    const result = advanceExecutionSchema.parse(validInput);
    expect(result.decision).toBe('Proceed to next step');
    expect(result.edgeId).toBe('edge-1');
    expect(result.confidence).toBe(0.95);
  });

  it('applies default confidence of 1.0 when not provided', () => {
    const result = advanceExecutionSchema.parse({
      decision: 'Go',
      edgeId: 'e1',
    });
    expect(result.confidence).toBe(1.0);
  });

  it('accepts optional input field', () => {
    const result = advanceExecutionSchema.parse({
      ...validInput,
      input: { key: 'value', nested: { data: true } },
    });
    expect(result.input).toEqual({ key: 'value', nested: { data: true } });
  });

  it('rejects missing decision', () => {
    expect(() =>
      advanceExecutionSchema.parse({ edgeId: 'e1' }),
    ).toThrow();
  });

  it('rejects empty decision', () => {
    expect(() =>
      advanceExecutionSchema.parse({ decision: '', edgeId: 'e1' }),
    ).toThrow();
  });

  it('rejects missing edgeId', () => {
    expect(() =>
      advanceExecutionSchema.parse({ decision: 'Go' }),
    ).toThrow();
  });

  it('rejects empty edgeId', () => {
    expect(() =>
      advanceExecutionSchema.parse({ decision: 'Go', edgeId: '' }),
    ).toThrow();
  });

  it('rejects confidence > 1', () => {
    expect(() =>
      advanceExecutionSchema.parse({ ...validInput, confidence: 1.5 }),
    ).toThrow();
  });

  it('rejects confidence < 0', () => {
    expect(() =>
      advanceExecutionSchema.parse({ ...validInput, confidence: -0.1 }),
    ).toThrow();
  });

  it('accepts confidence of 0', () => {
    const result = advanceExecutionSchema.parse({ ...validInput, confidence: 0 });
    expect(result.confidence).toBe(0);
  });

  it('accepts confidence of 1', () => {
    const result = advanceExecutionSchema.parse({ ...validInput, confidence: 1 });
    expect(result.confidence).toBe(1);
  });
});

describe('abortExecutionSchema', () => {
  it('accepts valid input', () => {
    const result = abortExecutionSchema.parse({ reason: 'External event' });
    expect(result.reason).toBe('External event');
  });

  it('rejects missing reason', () => {
    expect(() => abortExecutionSchema.parse({})).toThrow();
  });

  it('rejects empty reason', () => {
    expect(() => abortExecutionSchema.parse({ reason: '' })).toThrow();
  });
});

describe('escalateExecutionSchema', () => {
  it('accepts valid input', () => {
    const result = escalateExecutionSchema.parse({ reason: 'Requires manager approval' });
    expect(result.reason).toBe('Requires manager approval');
  });

  it('rejects missing reason', () => {
    expect(() => escalateExecutionSchema.parse({})).toThrow();
  });

  it('rejects empty reason', () => {
    expect(() => escalateExecutionSchema.parse({ reason: '' })).toThrow();
  });
});

// --- Phase 3: Handoff Schemas ---

describe('createHandoffSchema', () => {
  it('accepts valid input with required fields', () => {
    const result = createHandoffSchema.parse({
      surrogateId: validUUID,
      type: HandoffType.DIGITAL_TO_DIGITAL,
    });
    expect(result.surrogateId).toBe(validUUID);
    expect(result.type).toBe('DIGITAL_TO_DIGITAL');
  });

  it('accepts all optional fields', () => {
    const result = createHandoffSchema.parse({
      surrogateId: validUUID,
      targetSurrogateId: validUUID2,
      type: HandoffType.DIGITAL_TO_HUMAN,
      sessionId: validUUID,
      context: { reason: 'shift change' },
    });
    expect(result.targetSurrogateId).toBe(validUUID2);
    expect(result.context).toEqual({ reason: 'shift change' });
  });

  it('rejects missing surrogateId', () => {
    expect(() =>
      createHandoffSchema.parse({ type: HandoffType.DIGITAL_TO_DIGITAL }),
    ).toThrow();
  });

  it('rejects invalid UUID for surrogateId', () => {
    expect(() =>
      createHandoffSchema.parse({ surrogateId: 'bad', type: HandoffType.DIGITAL_TO_DIGITAL }),
    ).toThrow();
  });

  it('rejects missing type', () => {
    expect(() =>
      createHandoffSchema.parse({ surrogateId: validUUID }),
    ).toThrow();
  });

  it('rejects invalid handoff type', () => {
    expect(() =>
      createHandoffSchema.parse({ surrogateId: validUUID, type: 'INVALID_TYPE' }),
    ).toThrow();
  });

  it('accepts all valid handoff types', () => {
    for (const type of [HandoffType.DIGITAL_TO_DIGITAL, HandoffType.DIGITAL_TO_HUMAN, HandoffType.HUMAN_TO_DIGITAL]) {
      const result = createHandoffSchema.parse({ surrogateId: validUUID, type });
      expect(result.type).toBe(type);
    }
  });
});

describe('acceptHandoffSchema', () => {
  it('accepts empty object', () => {
    const result = acceptHandoffSchema.parse({});
    expect(result).toEqual({});
  });
});

// --- Phase 3: Persona Template Schemas ---

describe('createPersonaTemplateSchema', () => {
  const validInput = {
    name: 'Customer Service Rep',
    domain: 'customer-support',
    jurisdiction: 'US',
  };

  it('accepts valid input with required fields', () => {
    const result = createPersonaTemplateSchema.parse(validInput);
    expect(result.name).toBe('Customer Service Rep');
    expect(result.domain).toBe('customer-support');
    expect(result.jurisdiction).toBe('US');
  });

  it('accepts all optional fields', () => {
    const result = createPersonaTemplateSchema.parse({
      ...validInput,
      description: 'A helpful support representative',
      baseConfig: { empathyLevel: 8 },
      tags: ['support', 'customer-facing'],
      category: 'support',
    });
    expect(result.description).toBe('A helpful support representative');
    expect(result.tags).toEqual(['support', 'customer-facing']);
  });

  it('rejects missing name', () => {
    expect(() =>
      createPersonaTemplateSchema.parse({ domain: 'test', jurisdiction: 'US' }),
    ).toThrow();
  });

  it('rejects name shorter than 2 characters', () => {
    expect(() =>
      createPersonaTemplateSchema.parse({ ...validInput, name: 'A' }),
    ).toThrow();
  });

  it('rejects missing domain', () => {
    expect(() =>
      createPersonaTemplateSchema.parse({ name: 'Test', jurisdiction: 'US' }),
    ).toThrow();
  });

  it('rejects missing jurisdiction', () => {
    expect(() =>
      createPersonaTemplateSchema.parse({ name: 'Test', domain: 'test' }),
    ).toThrow();
  });
});

describe('updatePersonaTemplateSchema', () => {
  it('accepts partial updates', () => {
    const result = updatePersonaTemplateSchema.parse({ name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
  });

  it('accepts empty object (no updates)', () => {
    const result = updatePersonaTemplateSchema.parse({});
    expect(result).toEqual({});
  });

  it('rejects name shorter than 2 characters', () => {
    expect(() =>
      updatePersonaTemplateSchema.parse({ name: 'A' }),
    ).toThrow();
  });
});

// --- Phase 3: Marketplace Schemas ---

describe('publishMarketplaceListingSchema', () => {
  const validInput = {
    sopId: validUUID,
    title: 'Customer Onboarding SOP',
    description: 'Standard onboarding procedure',
    domain: 'customer-support',
  };

  it('accepts valid input', () => {
    const result = publishMarketplaceListingSchema.parse(validInput);
    expect(result.sopId).toBe(validUUID);
    expect(result.title).toBe('Customer Onboarding SOP');
    expect(result.price).toBe(0); // default
  });

  it('accepts optional fields', () => {
    const result = publishMarketplaceListingSchema.parse({
      ...validInput,
      category: 'onboarding',
      tags: ['onboarding', 'customer'],
      price: 9.99,
    });
    expect(result.category).toBe('onboarding');
    expect(result.tags).toEqual(['onboarding', 'customer']);
    expect(result.price).toBe(9.99);
  });

  it('rejects missing sopId', () => {
    expect(() =>
      publishMarketplaceListingSchema.parse({
        title: 'Test',
        description: 'Test',
        domain: 'test',
      }),
    ).toThrow();
  });

  it('rejects invalid UUID for sopId', () => {
    expect(() =>
      publishMarketplaceListingSchema.parse({ ...validInput, sopId: 'bad-id' }),
    ).toThrow();
  });

  it('rejects negative price', () => {
    expect(() =>
      publishMarketplaceListingSchema.parse({ ...validInput, price: -1 }),
    ).toThrow();
  });

  it('accepts zero price', () => {
    const result = publishMarketplaceListingSchema.parse({ ...validInput, price: 0 });
    expect(result.price).toBe(0);
  });
});

describe('installMarketplaceListingSchema', () => {
  it('accepts empty object', () => {
    const result = installMarketplaceListingSchema.parse({});
    expect(result).toEqual({});
  });
});

describe('createMarketplaceReviewSchema', () => {
  it('accepts valid rating with optional comment', () => {
    const result = createMarketplaceReviewSchema.parse({
      rating: 5,
      comment: 'Great SOP!',
    });
    expect(result.rating).toBe(5);
    expect(result.comment).toBe('Great SOP!');
  });

  it('accepts rating without comment', () => {
    const result = createMarketplaceReviewSchema.parse({ rating: 3 });
    expect(result.rating).toBe(3);
  });

  it('rejects missing rating', () => {
    expect(() => createMarketplaceReviewSchema.parse({})).toThrow();
  });

  it('rejects rating below 1', () => {
    expect(() => createMarketplaceReviewSchema.parse({ rating: 0 })).toThrow();
  });

  it('rejects rating above 5', () => {
    expect(() => createMarketplaceReviewSchema.parse({ rating: 6 })).toThrow();
  });

  it('rejects non-integer rating', () => {
    expect(() => createMarketplaceReviewSchema.parse({ rating: 3.5 })).toThrow();
  });

  it('accepts boundary ratings 1 and 5', () => {
    expect(createMarketplaceReviewSchema.parse({ rating: 1 }).rating).toBe(1);
    expect(createMarketplaceReviewSchema.parse({ rating: 5 }).rating).toBe(5);
  });
});

// --- Phase 3: Bias Check Schemas ---

describe('triggerBiasCheckSchema', () => {
  it('accepts valid surrogateId', () => {
    const result = triggerBiasCheckSchema.parse({ surrogateId: validUUID });
    expect(result.surrogateId).toBe(validUUID);
  });

  it('accepts empty object (surrogateId is optional)', () => {
    const result = triggerBiasCheckSchema.parse({});
    expect(result.surrogateId).toBeUndefined();
  });

  it('rejects invalid UUID for surrogateId', () => {
    expect(() =>
      triggerBiasCheckSchema.parse({ surrogateId: 'not-uuid' }),
    ).toThrow();
  });
});

// --- Phase 4B: Federation Schemas ---

describe('createFederationContributionSchema', () => {
  const validInput = {
    domain: 'customer-support',
    decisionData: [{ decision: 'approve', confidence: 0.9 }],
  };

  it('accepts valid input with defaults', () => {
    const result = createFederationContributionSchema.parse(validInput);
    expect(result.domain).toBe('customer-support');
    expect(result.decisionData).toHaveLength(1);
    expect(result.epsilon).toBe(1.0); // default
  });

  it('accepts optional category and custom epsilon', () => {
    const result = createFederationContributionSchema.parse({
      ...validInput,
      category: 'escalation-patterns',
      epsilon: 0.5,
    });
    expect(result.category).toBe('escalation-patterns');
    expect(result.epsilon).toBe(0.5);
  });

  it('rejects missing domain', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        decisionData: [{ decision: 'a' }],
      }),
    ).toThrow();
  });

  it('rejects empty domain', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        domain: '',
        decisionData: [{ decision: 'a' }],
      }),
    ).toThrow();
  });

  it('rejects missing decisionData', () => {
    expect(() =>
      createFederationContributionSchema.parse({ domain: 'test' }),
    ).toThrow();
  });

  it('rejects empty decisionData array', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        domain: 'test',
        decisionData: [],
      }),
    ).toThrow();
  });

  it('rejects epsilon below 0.01', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        ...validInput,
        epsilon: 0.001,
      }),
    ).toThrow();
  });

  it('rejects epsilon above 10', () => {
    expect(() =>
      createFederationContributionSchema.parse({
        ...validInput,
        epsilon: 11,
      }),
    ).toThrow();
  });

  it('accepts epsilon at boundaries (0.01 and 10)', () => {
    expect(
      createFederationContributionSchema.parse({ ...validInput, epsilon: 0.01 }).epsilon,
    ).toBe(0.01);
    expect(
      createFederationContributionSchema.parse({ ...validInput, epsilon: 10 }).epsilon,
    ).toBe(10);
  });
});

describe('federationInsightsQuerySchema', () => {
  it('accepts empty object', () => {
    const result = federationInsightsQuerySchema.parse({});
    expect(result).toEqual({});
  });

  it('accepts domain filter', () => {
    const result = federationInsightsQuerySchema.parse({ domain: 'support' });
    expect(result.domain).toBe('support');
  });

  it('accepts category filter', () => {
    const result = federationInsightsQuerySchema.parse({ category: 'escalation' });
    expect(result.category).toBe('escalation');
  });

  it('accepts both filters', () => {
    const result = federationInsightsQuerySchema.parse({
      domain: 'support',
      category: 'escalation',
    });
    expect(result.domain).toBe('support');
    expect(result.category).toBe('escalation');
  });
});

describe('applyFederationInsightsSchema', () => {
  it('accepts valid input', () => {
    const result = applyFederationInsightsSchema.parse({
      insights: [{ pattern: 'faster escalation' }],
    });
    expect(result.insights).toHaveLength(1);
  });

  it('accepts optional rationale', () => {
    const result = applyFederationInsightsSchema.parse({
      insights: [{ data: true }],
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
});

describe('updateFederationParticipationSchema', () => {
  it('accepts opted in with domains', () => {
    const result = updateFederationParticipationSchema.parse({
      optedIn: true,
      domains: ['support', 'finance'],
    });
    expect(result.optedIn).toBe(true);
    expect(result.domains).toEqual(['support', 'finance']);
  });

  it('accepts opted out', () => {
    const result = updateFederationParticipationSchema.parse({ optedIn: false });
    expect(result.optedIn).toBe(false);
  });

  it('rejects missing optedIn', () => {
    expect(() =>
      updateFederationParticipationSchema.parse({ domains: ['test'] }),
    ).toThrow();
  });
});

// --- Phase 3: Fleet Filter Schema ---

describe('fleetFilterSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = fleetFilterSchema.parse({});
    expect(result).toEqual({});
  });

  it('accepts all filter fields', () => {
    const result = fleetFilterSchema.parse({
      domain: 'healthcare',
      status: 'ACTIVE',
      jurisdiction: 'EU',
    });
    expect(result.domain).toBe('healthcare');
    expect(result.status).toBe('ACTIVE');
    expect(result.jurisdiction).toBe('EU');
  });

  it('accepts partial filters', () => {
    const result = fleetFilterSchema.parse({ domain: 'finance' });
    expect(result.domain).toBe('finance');
    expect(result.status).toBeUndefined();
    expect(result.jurisdiction).toBeUndefined();
  });
});

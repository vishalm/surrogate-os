import { describe, it, expect } from 'vitest';
import {
  addLaplacianNoise,
  clipGradient,
  anonymizeDecisionData,
  computePrivacyBudget,
  generateAggregateInsights,
} from './differential-privacy.js';

describe('addLaplacianNoise()', () => {
  it('adds noise so output differs from input (statistically)', () => {
    const original = 100;
    // Run multiple times — at least one should differ
    const results = Array.from({ length: 20 }, () =>
      addLaplacianNoise(original, 1.0, 1.0),
    );
    const allSame = results.every((r) => r === original);
    expect(allSame).toBe(false);
  });

  it('with very large epsilon returns value very close to original', () => {
    const original = 42;
    const epsilon = 1e12; // extremely large => scale ~ 0 => virtually no noise
    const results = Array.from({ length: 10 }, () =>
      addLaplacianNoise(original, epsilon, 1.0),
    );
    for (const r of results) {
      expect(Math.abs(r - original)).toBeLessThan(0.01);
    }
  });

  it('with small epsilon adds more noise than large epsilon (on average)', () => {
    const original = 50;
    const sensitivity = 1.0;
    const runs = 200;

    const smallEpsilonDeviations = Array.from({ length: runs }, () =>
      Math.abs(addLaplacianNoise(original, 0.1, sensitivity) - original),
    );
    const largeEpsilonDeviations = Array.from({ length: runs }, () =>
      Math.abs(addLaplacianNoise(original, 10, sensitivity) - original),
    );

    const avgSmall = smallEpsilonDeviations.reduce((a, b) => a + b, 0) / runs;
    const avgLarge = largeEpsilonDeviations.reduce((a, b) => a + b, 0) / runs;

    expect(avgSmall).toBeGreaterThan(avgLarge);
  });

  it('throws for epsilon <= 0', () => {
    expect(() => addLaplacianNoise(10, 0, 1)).toThrow('Epsilon must be positive');
    expect(() => addLaplacianNoise(10, -1, 1)).toThrow('Epsilon must be positive');
  });

  it('throws for negative sensitivity', () => {
    expect(() => addLaplacianNoise(10, 1, -1)).toThrow('Sensitivity must be non-negative');
  });

  it('returns original value when sensitivity is 0 (no noise)', () => {
    const result = addLaplacianNoise(42, 1.0, 0);
    expect(result).toBe(42);
  });
});

describe('clipGradient()', () => {
  it('clips values exceeding maxNorm', () => {
    // Vector [3, 4] has L2 norm 5
    const gradient = [3, 4];
    const clipped = clipGradient(gradient, 2.5);

    const clippedNorm = Math.sqrt(clipped.reduce((sum, v) => sum + v * v, 0));
    expect(clippedNorm).toBeCloseTo(2.5, 5);
  });

  it('does not modify values within norm', () => {
    const gradient = [1, 2]; // L2 norm ~ 2.236
    const clipped = clipGradient(gradient, 5.0);

    expect(clipped).toEqual([1, 2]);
  });

  it('preserves direction when clipping', () => {
    const gradient = [3, 4]; // norm 5
    const clipped = clipGradient(gradient, 2.5);

    // Ratio between components should be preserved
    const ratio = gradient[0] / gradient[1];
    const clippedRatio = clipped[0] / clipped[1];
    expect(clippedRatio).toBeCloseTo(ratio, 5);
  });

  it('handles zero vector', () => {
    const gradient = [0, 0, 0];
    const clipped = clipGradient(gradient, 1.0);
    expect(clipped).toEqual([0, 0, 0]);
  });

  it('handles single-element vector', () => {
    const clipped = clipGradient([10], 3);
    expect(clipped).toEqual([3]);
  });

  it('returns a new array (does not mutate input)', () => {
    const gradient = [1, 2, 3];
    const clipped = clipGradient(gradient, 100);
    expect(clipped).toEqual(gradient);
    expect(clipped).not.toBe(gradient);
  });

  it('throws for non-positive maxNorm', () => {
    expect(() => clipGradient([1, 2], 0)).toThrow('maxNorm must be positive');
    expect(() => clipGradient([1, 2], -1)).toThrow('maxNorm must be positive');
  });
});

describe('anonymizeDecisionData()', () => {
  it('strips PII fields (email, name, phone, etc.)', () => {
    const decisions = [
      {
        email: 'john@example.com',
        name: 'John Doe',
        phone: '555-1234',
        password: 'secret',
        decision: 'approve',
      },
    ];

    const anonymized = anonymizeDecisionData(decisions);
    expect(anonymized).toHaveLength(1);
    expect(anonymized[0]).not.toHaveProperty('email');
    expect(anonymized[0]).not.toHaveProperty('name');
    expect(anonymized[0]).not.toHaveProperty('phone');
    expect(anonymized[0]).not.toHaveProperty('password');
    expect(anonymized[0]).toHaveProperty('decision', 'approve');
  });

  it('generalizes timestamps to day granularity', () => {
    const decisions = [
      { created_at: '2025-06-15T14:30:45.123Z' },
    ];

    const anonymized = anonymizeDecisionData(decisions);
    const ts = anonymized[0].created_at as string;

    // Should be start of day in UTC
    expect(ts).toBe('2025-06-15T00:00:00.000Z');
  });

  it('adds noise to confidence fields', () => {
    const decisions = [{ confidence: 0.85 }];
    const results = Array.from({ length: 20 }, () =>
      anonymizeDecisionData(decisions)[0].confidence as number,
    );

    // At least one should differ from the original
    const allSame = results.every((r) => r === 0.85);
    expect(allSame).toBe(false);

    // All should be clamped to [0, 1]
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('hashes ID fields', () => {
    const decisions = [{ userId: 'user-123', orgId: 'org-456' }];
    const anonymized = anonymizeDecisionData(decisions);

    expect(anonymized[0].userId).not.toBe('user-123');
    expect(typeof anonymized[0].userId).toBe('string');
    // Hashed IDs are 16-character hex strings
    expect(anonymized[0].userId).toMatch(/^[a-f0-9]{16}$/);
  });

  it('returns empty array for empty input', () => {
    const anonymized = anonymizeDecisionData([]);
    expect(anonymized).toEqual([]);
  });

  it('preserves non-sensitive, non-special fields', () => {
    const decisions = [{ decision: 'approve', category: 'finance', priority: 'high' }];
    const anonymized = anonymizeDecisionData(decisions);

    expect(anonymized[0].decision).toBe('approve');
    expect(anonymized[0].category).toBe('finance');
    expect(anonymized[0].priority).toBe('high');
  });

  it('handles multiple records', () => {
    const decisions = [
      { decision: 'approve', email: 'a@b.com' },
      { decision: 'reject', email: 'c@d.com' },
      { decision: 'escalate', email: 'e@f.com' },
    ];
    const anonymized = anonymizeDecisionData(decisions);

    expect(anonymized).toHaveLength(3);
    for (const record of anonymized) {
      expect(record).not.toHaveProperty('email');
      expect(record).toHaveProperty('decision');
    }
  });
});

describe('computePrivacyBudget()', () => {
  it('accumulates correctly via sequential composition', () => {
    expect(computePrivacyBudget(5, 0.5)).toBe(2.5);
    expect(computePrivacyBudget(10, 1.0)).toBe(10);
    expect(computePrivacyBudget(0, 1.0)).toBe(0);
  });

  it('returns 0 for 0 queries', () => {
    expect(computePrivacyBudget(0, 5.0)).toBe(0);
  });

  it('scales linearly with number of queries', () => {
    const epsilon = 0.3;
    const budget5 = computePrivacyBudget(5, epsilon);
    const budget10 = computePrivacyBudget(10, epsilon);
    expect(budget10).toBeCloseTo(budget5 * 2, 10);
  });
});

describe('generateAggregateInsights()', () => {
  it('returns valid structure for non-empty data', () => {
    const data = [
      { decision: 'approve', confidence: 0.9 },
      { decision: 'approve', confidence: 0.85 },
      { decision: 'reject', confidence: 0.7 },
    ];

    const insights = generateAggregateInsights(data);

    expect(insights).toHaveProperty('totalRecords');
    expect(typeof insights.totalRecords).toBe('number');
    expect(insights).toHaveProperty('avgConfidence');
    expect(insights).toHaveProperty('decisionDistribution');
    expect(insights).toHaveProperty('escalationRate');
    expect(typeof insights.escalationRate).toBe('number');
    expect(insights).toHaveProperty('commonPatterns');
    expect(Array.isArray(insights.commonPatterns)).toBe(true);
  });

  it('returns null avgConfidence and zero totals for empty data', () => {
    const insights = generateAggregateInsights([]);

    expect(insights.totalRecords).toBe(0);
    expect(insights.avgConfidence).toBeNull();
    expect(insights.decisionDistribution).toEqual({});
    expect(insights.escalationRate).toBe(0);
    expect(insights.commonPatterns).toEqual([]);
  });

  it('includes escalation rate for escalation data', () => {
    const data = [
      { decision: 'approve', escalated: false },
      { decision: 'escalate', escalated: true },
      { decision: 'approve', escalated: false },
    ];

    const insights = generateAggregateInsights(data);
    // Escalation rate should be > 0 (with noise, exact value varies)
    expect(typeof insights.escalationRate).toBe('number');
    expect(insights.escalationRate).toBeGreaterThanOrEqual(0);
    expect(insights.escalationRate).toBeLessThanOrEqual(1);
  });

  it('limits common patterns to at most 5 entries', () => {
    const data = Array.from({ length: 50 }, (_, i) => ({
      decision: `decision-${i % 8}`,
      confidence: 0.5,
    }));

    const insights = generateAggregateInsights(data);
    const patterns = insights.commonPatterns as Array<{ decision: string; count: number }>;
    expect(patterns.length).toBeLessThanOrEqual(5);
  });

  it('clamps avgConfidence to [0, 1]', () => {
    const data = [
      { confidence: 0.99 },
      { confidence: 0.98 },
      { confidence: 0.97 },
    ];

    // Run multiple times since noise is random
    for (let i = 0; i < 20; i++) {
      const insights = generateAggregateInsights(data);
      if (insights.avgConfidence !== null) {
        expect(insights.avgConfidence).toBeGreaterThanOrEqual(0);
        expect(insights.avgConfidence).toBeLessThanOrEqual(1);
      }
    }
  });
});

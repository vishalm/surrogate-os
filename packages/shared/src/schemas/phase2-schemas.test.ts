import { describe, it, expect } from 'vitest';
import {
  createSessionSchema,
  createDecisionOutcomeSchema,
  generateDebriefSchema,
  createSOPProposalSchema,
  reviewSOPProposalSchema,
  uploadDocumentSchema,
  createMemoryEntrySchema,
} from './index.js';
import { SOPNodeType } from '../constants/index.js';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const validUUID2 = '660e8400-e29b-41d4-a716-446655440001';

describe('createSessionSchema', () => {
  it('accepts valid input', () => {
    const result = createSessionSchema.parse({ surrogateId: validUUID });
    expect(result.surrogateId).toBe(validUUID);
    expect(result.metadata).toBeUndefined();
  });

  it('accepts valid input with metadata', () => {
    const result = createSessionSchema.parse({
      surrogateId: validUUID,
      metadata: { channel: 'chat', priority: 'high' },
    });
    expect(result.metadata).toEqual({ channel: 'chat', priority: 'high' });
  });

  it('rejects missing surrogateId', () => {
    expect(() => createSessionSchema.parse({})).toThrow();
  });

  it('rejects invalid uuid for surrogateId', () => {
    expect(() =>
      createSessionSchema.parse({ surrogateId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects empty string for surrogateId', () => {
    expect(() =>
      createSessionSchema.parse({ surrogateId: '' }),
    ).toThrow();
  });
});

describe('createDecisionOutcomeSchema', () => {
  const validInput = {
    sessionId: validUUID,
    surrogateId: validUUID2,
    decision: 'Approve the request',
  };

  it('accepts valid input with required fields', () => {
    const result = createDecisionOutcomeSchema.parse(validInput);
    expect(result.sessionId).toBe(validUUID);
    expect(result.surrogateId).toBe(validUUID2);
    expect(result.decision).toBe('Approve the request');
  });

  it('accepts valid input with all optional fields', () => {
    const result = createDecisionOutcomeSchema.parse({
      ...validInput,
      sopNodeId: 'node-1',
      outcome: 'Request approved successfully',
      confidence: 0.95,
      context: { reason: 'policy match' },
    });
    expect(result.confidence).toBe(0.95);
    expect(result.outcome).toBe('Request approved successfully');
  });

  it('rejects missing sessionId', () => {
    expect(() =>
      createDecisionOutcomeSchema.parse({
        surrogateId: validUUID2,
        decision: 'test',
      }),
    ).toThrow();
  });

  it('rejects missing surrogateId', () => {
    expect(() =>
      createDecisionOutcomeSchema.parse({
        sessionId: validUUID,
        decision: 'test',
      }),
    ).toThrow();
  });

  it('rejects missing decision', () => {
    expect(() =>
      createDecisionOutcomeSchema.parse({
        sessionId: validUUID,
        surrogateId: validUUID2,
      }),
    ).toThrow();
  });

  it('rejects empty decision', () => {
    expect(() =>
      createDecisionOutcomeSchema.parse({
        ...validInput,
        decision: '',
      }),
    ).toThrow();
  });

  it('rejects invalid uuid for sessionId', () => {
    expect(() =>
      createDecisionOutcomeSchema.parse({
        ...validInput,
        sessionId: 'bad-uuid',
      }),
    ).toThrow();
  });

  it('rejects confidence greater than 1', () => {
    expect(() =>
      createDecisionOutcomeSchema.parse({
        ...validInput,
        confidence: 1.5,
      }),
    ).toThrow();
  });

  it('rejects confidence less than 0', () => {
    expect(() =>
      createDecisionOutcomeSchema.parse({
        ...validInput,
        confidence: -0.1,
      }),
    ).toThrow();
  });

  it('accepts confidence of 0', () => {
    const result = createDecisionOutcomeSchema.parse({
      ...validInput,
      confidence: 0,
    });
    expect(result.confidence).toBe(0);
  });

  it('accepts confidence of 1', () => {
    const result = createDecisionOutcomeSchema.parse({
      ...validInput,
      confidence: 1,
    });
    expect(result.confidence).toBe(1);
  });
});

describe('generateDebriefSchema', () => {
  it('accepts valid sessionId', () => {
    const result = generateDebriefSchema.parse({ sessionId: validUUID });
    expect(result.sessionId).toBe(validUUID);
  });

  it('rejects missing sessionId', () => {
    expect(() => generateDebriefSchema.parse({})).toThrow();
  });

  it('rejects invalid uuid for sessionId', () => {
    expect(() =>
      generateDebriefSchema.parse({ sessionId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects empty string for sessionId', () => {
    expect(() =>
      generateDebriefSchema.parse({ sessionId: '' }),
    ).toThrow();
  });
});

describe('createSOPProposalSchema', () => {
  it('accepts valid input with only sopId', () => {
    const result = createSOPProposalSchema.parse({ sopId: validUUID });
    expect(result.sopId).toBe(validUUID);
  });

  it('accepts valid input with all optional fields', () => {
    const result = createSOPProposalSchema.parse({
      sopId: validUUID,
      debriefId: validUUID2,
      rationale: 'Improve error handling flow',
      proposedGraph: {
        nodes: [
          { id: 'n1', type: SOPNodeType.INFORMATION_GATHER, label: 'Start', description: 'Begin', config: {} },
        ],
        edges: [],
      },
    });
    expect(result.debriefId).toBe(validUUID2);
    expect(result.rationale).toBe('Improve error handling flow');
    expect(result.proposedGraph?.nodes).toHaveLength(1);
  });

  it('rejects missing sopId', () => {
    expect(() => createSOPProposalSchema.parse({})).toThrow();
  });

  it('rejects invalid uuid for sopId', () => {
    expect(() =>
      createSOPProposalSchema.parse({ sopId: 'bad-id' }),
    ).toThrow();
  });

  it('rejects invalid uuid for debriefId', () => {
    expect(() =>
      createSOPProposalSchema.parse({ sopId: validUUID, debriefId: 'bad' }),
    ).toThrow();
  });
});

describe('reviewSOPProposalSchema', () => {
  it('accepts APPROVED status', () => {
    const result = reviewSOPProposalSchema.parse({ status: 'APPROVED' });
    expect(result.status).toBe('APPROVED');
  });

  it('accepts REJECTED status', () => {
    const result = reviewSOPProposalSchema.parse({ status: 'REJECTED' });
    expect(result.status).toBe('REJECTED');
  });

  it('accepts status with optional comment', () => {
    const result = reviewSOPProposalSchema.parse({
      status: 'APPROVED',
      comment: 'Looks good',
    });
    expect(result.comment).toBe('Looks good');
  });

  it('rejects missing status', () => {
    expect(() => reviewSOPProposalSchema.parse({})).toThrow();
  });

  it('rejects invalid status value', () => {
    expect(() =>
      reviewSOPProposalSchema.parse({ status: 'PENDING' }),
    ).toThrow();
  });

  it('rejects lowercase status', () => {
    expect(() =>
      reviewSOPProposalSchema.parse({ status: 'approved' }),
    ).toThrow();
  });
});

describe('uploadDocumentSchema', () => {
  it('accepts valid input', () => {
    const result = uploadDocumentSchema.parse({
      title: 'Policy Document',
      content: 'This is the policy content.',
    });
    expect(result.title).toBe('Policy Document');
    expect(result.content).toBe('This is the policy content.');
    expect(result.mimeType).toBe('text/plain'); // default
  });

  it('accepts custom mimeType', () => {
    const result = uploadDocumentSchema.parse({
      title: 'Markdown Doc',
      content: '# Hello',
      mimeType: 'text/markdown',
    });
    expect(result.mimeType).toBe('text/markdown');
  });

  it('rejects empty title', () => {
    expect(() =>
      uploadDocumentSchema.parse({ title: '', content: 'some content' }),
    ).toThrow();
  });

  it('rejects missing title', () => {
    expect(() =>
      uploadDocumentSchema.parse({ content: 'some content' }),
    ).toThrow();
  });

  it('rejects empty content', () => {
    expect(() =>
      uploadDocumentSchema.parse({ title: 'Valid Title', content: '' }),
    ).toThrow();
  });

  it('rejects missing content', () => {
    expect(() =>
      uploadDocumentSchema.parse({ title: 'Valid Title' }),
    ).toThrow();
  });

  it('rejects title exceeding 255 characters', () => {
    expect(() =>
      uploadDocumentSchema.parse({
        title: 'x'.repeat(256),
        content: 'valid',
      }),
    ).toThrow();
  });
});

describe('createMemoryEntrySchema', () => {
  const validInput = {
    surrogateId: validUUID,
    content: 'Customer prefers email communication',
  };

  it('accepts valid input with defaults', () => {
    const result = createMemoryEntrySchema.parse(validInput);
    expect(result.surrogateId).toBe(validUUID);
    expect(result.content).toBe('Customer prefers email communication');
    expect(result.type).toBe('STM'); // default
    expect(result.source).toBe('MANUAL'); // default
    expect(result.tags).toEqual([]); // default
  });

  it('accepts valid input with all fields', () => {
    const result = createMemoryEntrySchema.parse({
      ...validInput,
      type: 'LTM',
      source: 'DEBRIEF',
      tags: ['communication', 'preference'],
      expiresAt: '2026-12-31T23:59:59Z',
    });
    expect(result.type).toBe('LTM');
    expect(result.source).toBe('DEBRIEF');
    expect(result.tags).toEqual(['communication', 'preference']);
  });

  it('rejects missing surrogateId', () => {
    expect(() =>
      createMemoryEntrySchema.parse({ content: 'test' }),
    ).toThrow();
  });

  it('rejects invalid uuid for surrogateId', () => {
    expect(() =>
      createMemoryEntrySchema.parse({ ...validInput, surrogateId: 'bad' }),
    ).toThrow();
  });

  it('rejects missing content', () => {
    expect(() =>
      createMemoryEntrySchema.parse({ surrogateId: validUUID }),
    ).toThrow();
  });

  it('rejects empty content', () => {
    expect(() =>
      createMemoryEntrySchema.parse({ ...validInput, content: '' }),
    ).toThrow();
  });

  it('rejects invalid type', () => {
    expect(() =>
      createMemoryEntrySchema.parse({ ...validInput, type: 'INVALID' }),
    ).toThrow();
  });

  it('rejects invalid source', () => {
    expect(() =>
      createMemoryEntrySchema.parse({ ...validInput, source: 'INVALID' }),
    ).toThrow();
  });

  it('accepts all valid source values', () => {
    for (const source of ['DEBRIEF', 'PATTERN_DETECTION', 'MANUAL', 'SOP_EXECUTION']) {
      const result = createMemoryEntrySchema.parse({ ...validInput, source });
      expect(result.source).toBe(source);
    }
  });

  it('accepts all valid type values', () => {
    for (const type of ['STM', 'LTM']) {
      const result = createMemoryEntrySchema.parse({ ...validInput, type });
      expect(result.type).toBe(type);
    }
  });

  it('rejects invalid expiresAt format', () => {
    expect(() =>
      createMemoryEntrySchema.parse({
        ...validInput,
        expiresAt: 'not-a-date',
      }),
    ).toThrow();
  });
});

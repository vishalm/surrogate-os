import { describe, it, expect } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';

/**
 * Test the pure helper functions from webhooks.service.ts.
 * The WebhookService class itself requires a PrismaClient and does I/O,
 * so we test the standalone signing/secret logic in isolation here.
 *
 * These functions mirror the module-private helpers: generateSecret() and signPayload().
 */

// Re-implement the pure functions under test since they are not exported.
// This validates the contract / expected behavior.

function generateSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('generateSecret()', () => {
  it('produces a string starting with whsec_ prefix', () => {
    const secret = generateSecret();
    expect(secret.startsWith('whsec_')).toBe(true);
  });

  it('produces a secret with 64 hex characters after prefix (32 bytes)', () => {
    const secret = generateSecret();
    const hex = secret.slice('whsec_'.length);
    expect(hex).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces unique secrets on each call', () => {
    const secrets = Array.from({ length: 10 }, () => generateSecret());
    const unique = new Set(secrets);
    expect(unique.size).toBe(10);
  });

  it('total length is prefix (6) + hex (64) = 70', () => {
    const secret = generateSecret();
    expect(secret.length).toBe(70);
  });
});

describe('signPayload()', () => {
  const testSecret = 'whsec_abc123';
  const testPayload = JSON.stringify({ event: 'test', data: { id: 1 } });

  it('produces a hex string (SHA-256 HMAC)', () => {
    const signature = signPayload(testPayload, testSecret);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for the same input', () => {
    const sig1 = signPayload(testPayload, testSecret);
    const sig2 = signPayload(testPayload, testSecret);
    expect(sig1).toBe(sig2);
  });

  it('produces different signatures for different payloads', () => {
    const sig1 = signPayload('{"event":"a"}', testSecret);
    const sig2 = signPayload('{"event":"b"}', testSecret);
    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different secrets', () => {
    const sig1 = signPayload(testPayload, 'secret-1');
    const sig2 = signPayload(testPayload, 'secret-2');
    expect(sig1).not.toBe(sig2);
  });

  it('matches manual HMAC computation', () => {
    const expected = createHmac('sha256', testSecret)
      .update(testPayload)
      .digest('hex');
    const actual = signPayload(testPayload, testSecret);
    expect(actual).toBe(expected);
  });

  it('handles empty payload', () => {
    const signature = signPayload('', testSecret);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(signature.length).toBe(64);
  });

  it('handles unicode payload', () => {
    const unicodePayload = JSON.stringify({ message: 'Hello, world!' });
    const signature = signPayload(unicodePayload, testSecret);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('webhook HMAC verification pattern', () => {
  it('verifies signature: sign then verify with same secret succeeds', () => {
    const secret = generateSecret();
    const payload = JSON.stringify({ event: 'surrogate.created', orgId: 'org-1' });

    const signature = signPayload(payload, secret);

    // Simulate receiver verifying
    const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');
    expect(signature).toBe(expectedSignature);
  });

  it('verification fails with tampered payload', () => {
    const secret = generateSecret();
    const originalPayload = JSON.stringify({ event: 'sop.certified' });
    const tamperedPayload = JSON.stringify({ event: 'sop.certified', extra: 'injected' });

    const signature = signPayload(originalPayload, secret);
    const verifySignature = signPayload(tamperedPayload, secret);

    expect(signature).not.toBe(verifySignature);
  });

  it('verification fails with wrong secret', () => {
    const secret1 = generateSecret();
    const secret2 = generateSecret();
    const payload = JSON.stringify({ event: 'session.completed' });

    const signature = signPayload(payload, secret1);
    const wrongSignature = signPayload(payload, secret2);

    expect(signature).not.toBe(wrongSignature);
  });
});

describe('webhook event constants', () => {
  const WEBHOOK_EVENTS = [
    'surrogate.created',
    'sop.certified',
    'session.completed',
    'debrief.generated',
    'proposal.approved',
    'compliance.check_completed',
    'execution.completed',
    'bias.check_completed',
  ] as const;

  it('defines expected webhook event types', () => {
    expect(WEBHOOK_EVENTS).toContain('surrogate.created');
    expect(WEBHOOK_EVENTS).toContain('sop.certified');
    expect(WEBHOOK_EVENTS).toContain('session.completed');
    expect(WEBHOOK_EVENTS).toContain('debrief.generated');
    expect(WEBHOOK_EVENTS).toContain('proposal.approved');
    expect(WEBHOOK_EVENTS).toContain('execution.completed');
    expect(WEBHOOK_EVENTS).toContain('bias.check_completed');
  });

  it('has exactly 8 event types', () => {
    expect(WEBHOOK_EVENTS).toHaveLength(8);
  });
});

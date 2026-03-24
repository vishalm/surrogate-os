import { describe, it, expect } from 'vitest';
import {
  generateSigningKeyPair,
  signSOP,
  verifySOP,
  computeSOPFingerprint,
  buildChainOfCustody,
} from './sop-signing.js';

const sampleGraph = {
  nodes: [
    { id: 'n1', type: 'INFORMATION_GATHER', label: 'Start', description: 'Begin', config: {} },
    { id: 'n2', type: 'DECISION', label: 'Decide', description: 'Make a call', config: {} },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', condition: null, label: null },
  ],
};

describe('generateSigningKeyPair()', () => {
  it('produces valid PEM-encoded Ed25519 key pair', () => {
    const { publicKey, privateKey } = generateSigningKeyPair();

    expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(publicKey).toContain('-----END PUBLIC KEY-----');
    expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(privateKey).toContain('-----END PRIVATE KEY-----');
  });

  it('produces different key pairs on each call', () => {
    const pair1 = generateSigningKeyPair();
    const pair2 = generateSigningKeyPair();

    expect(pair1.publicKey).not.toBe(pair2.publicKey);
    expect(pair1.privateKey).not.toBe(pair2.privateKey);
  });
});

describe('signSOP()', () => {
  it('produces a signature result with all required fields', () => {
    const { privateKey } = generateSigningKeyPair();
    const result = signSOP(sampleGraph, privateKey);

    expect(result.signature).toBeDefined();
    expect(typeof result.signature).toBe('string');
    expect(result.signature.length).toBeGreaterThan(0);

    expect(result.signerPublicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(result.signedAt).toBeDefined();
    expect(result.algorithm).toBe('Ed25519');
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces deterministic signature for the same input and key', () => {
    const { privateKey } = generateSigningKeyPair();
    const sig1 = signSOP(sampleGraph, privateKey);
    const sig2 = signSOP(sampleGraph, privateKey);

    // Signature over the same data with the same Ed25519 key is deterministic
    expect(sig1.signature).toBe(sig2.signature);
    expect(sig1.fingerprint).toBe(sig2.fingerprint);
  });

  it('produces different signatures for different keys', () => {
    const pair1 = generateSigningKeyPair();
    const pair2 = generateSigningKeyPair();

    const sig1 = signSOP(sampleGraph, pair1.privateKey);
    const sig2 = signSOP(sampleGraph, pair2.privateKey);

    expect(sig1.signature).not.toBe(sig2.signature);
  });
});

describe('verifySOP()', () => {
  it('returns true for a valid signature', () => {
    const { privateKey, publicKey } = generateSigningKeyPair();
    const result = signSOP(sampleGraph, privateKey);

    const verified = verifySOP(sampleGraph, result.signature, publicKey);
    expect(verified).toBe(true);
  });

  it('also works with the public key derived from signSOP result', () => {
    const { privateKey } = generateSigningKeyPair();
    const result = signSOP(sampleGraph, privateKey);

    const verified = verifySOP(sampleGraph, result.signature, result.signerPublicKey);
    expect(verified).toBe(true);
  });

  it('returns false for a tampered graph', () => {
    const { privateKey, publicKey } = generateSigningKeyPair();
    const result = signSOP(sampleGraph, privateKey);

    const tampered = {
      ...sampleGraph,
      nodes: [
        ...sampleGraph.nodes,
        { id: 'n3', type: 'ESCALATION', label: 'Extra', description: 'Injected', config: {} },
      ],
    };

    const verified = verifySOP(tampered, result.signature, publicKey);
    expect(verified).toBe(false);
  });

  it('returns false for a subtly tampered graph (changed label)', () => {
    const { privateKey, publicKey } = generateSigningKeyPair();
    const result = signSOP(sampleGraph, privateKey);

    const tampered = {
      ...sampleGraph,
      nodes: sampleGraph.nodes.map((n) =>
        n.id === 'n1' ? { ...n, label: 'Modified Start' } : n,
      ),
    };

    const verified = verifySOP(tampered, result.signature, publicKey);
    expect(verified).toBe(false);
  });

  it('returns false for a wrong public key', () => {
    const pair1 = generateSigningKeyPair();
    const pair2 = generateSigningKeyPair();

    const result = signSOP(sampleGraph, pair1.privateKey);

    const verified = verifySOP(sampleGraph, result.signature, pair2.publicKey);
    expect(verified).toBe(false);
  });

  it('returns false for a garbage signature string', () => {
    const { publicKey } = generateSigningKeyPair();
    const verified = verifySOP(sampleGraph, 'not-a-real-signature', publicKey);
    expect(verified).toBe(false);
  });

  it('returns false for an empty signature', () => {
    const { publicKey } = generateSigningKeyPair();
    const verified = verifySOP(sampleGraph, '', publicKey);
    expect(verified).toBe(false);
  });
});

describe('computeSOPFingerprint()', () => {
  it('is deterministic (same input = same hash)', () => {
    const fp1 = computeSOPFingerprint(sampleGraph);
    const fp2 = computeSOPFingerprint(sampleGraph);
    expect(fp1).toBe(fp2);
  });

  it('produces a 64-character hex string (SHA-256)', () => {
    const fp = computeSOPFingerprint(sampleGraph);
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes with different input', () => {
    const fp1 = computeSOPFingerprint(sampleGraph);
    const fp2 = computeSOPFingerprint({ nodes: [], edges: [] });
    expect(fp1).not.toBe(fp2);
  });

  it('is key-order independent (canonical JSON)', () => {
    const graphA = { nodes: [], edges: [] };
    const graphB = { edges: [], nodes: [] };
    expect(computeSOPFingerprint(graphA)).toBe(computeSOPFingerprint(graphB));
  });

  it('handles nested objects correctly', () => {
    const graph1 = { data: { a: 1, b: 2 } };
    const graph2 = { data: { b: 2, a: 1 } };
    expect(computeSOPFingerprint(graph1)).toBe(computeSOPFingerprint(graph2));
  });

  it('differentiates between null and undefined values', () => {
    const graph1 = { value: null };
    const graph2 = { value: undefined };
    // These should produce different fingerprints since null and undefined serialize differently
    const fp1 = computeSOPFingerprint(graph1);
    const fp2 = computeSOPFingerprint(graph2);
    expect(fp1).not.toBe(fp2);
  });
});

describe('buildChainOfCustody()', () => {
  it('orders signatures correctly and verifies valid ones', () => {
    const pair1 = generateSigningKeyPair();
    const pair2 = generateSigningKeyPair();

    const sig1 = signSOP(sampleGraph, pair1.privateKey);
    const sig2 = signSOP(sampleGraph, pair2.privateKey);

    const chain = buildChainOfCustody(sampleGraph, [
      {
        id: 'sig-1',
        signerId: 'user-1',
        signature: sig1.signature,
        publicKey: pair1.publicKey,
        fingerprint: sig1.fingerprint,
        signedAt: sig1.signedAt,
      },
      {
        id: 'sig-2',
        signerId: 'user-2',
        signature: sig2.signature,
        publicKey: pair2.publicKey,
        fingerprint: sig2.fingerprint,
        signedAt: sig2.signedAt,
      },
    ]);

    expect(chain).toHaveLength(2);
    expect(chain[0].signatureId).toBe('sig-1');
    expect(chain[0].signerId).toBe('user-1');
    expect(chain[0].verified).toBe(true);
    expect(chain[1].signatureId).toBe('sig-2');
    expect(chain[1].signerId).toBe('user-2');
    expect(chain[1].verified).toBe(true);
  });

  it('detects invalid signatures in the chain', () => {
    const pair1 = generateSigningKeyPair();
    const pair2 = generateSigningKeyPair();

    const sig1 = signSOP(sampleGraph, pair1.privateKey);

    const chain = buildChainOfCustody(sampleGraph, [
      {
        id: 'sig-1',
        signerId: 'user-1',
        signature: sig1.signature,
        publicKey: pair1.publicKey,
        fingerprint: sig1.fingerprint,
        signedAt: sig1.signedAt,
      },
      {
        id: 'sig-2',
        signerId: 'user-2',
        signature: 'invalid-base64-signature',
        publicKey: pair2.publicKey,
        fingerprint: 'bad-fingerprint',
        signedAt: new Date().toISOString(),
      },
    ]);

    expect(chain).toHaveLength(2);
    expect(chain[0].verified).toBe(true);
    expect(chain[1].verified).toBe(false);
  });

  it('returns empty chain for empty signatures array', () => {
    const chain = buildChainOfCustody(sampleGraph, []);
    expect(chain).toHaveLength(0);
  });

  it('detects signature mismatch when graph was tampered after signing', () => {
    const pair = generateSigningKeyPair();
    const sig = signSOP(sampleGraph, pair.privateKey);

    const tamperedGraph = { ...sampleGraph, extra: 'tampering' };

    const chain = buildChainOfCustody(tamperedGraph, [
      {
        id: 'sig-1',
        signerId: 'user-1',
        signature: sig.signature,
        publicKey: pair.publicKey,
        fingerprint: sig.fingerprint,
        signedAt: sig.signedAt,
      },
    ]);

    expect(chain[0].verified).toBe(false);
  });
});

describe('round-trip: generate keys -> sign -> verify -> build chain', () => {
  it('completes a full cryptographic lifecycle', () => {
    const pair = generateSigningKeyPair();

    // Sign
    const sigResult = signSOP(sampleGraph, pair.privateKey);
    expect(sigResult.signature.length).toBeGreaterThan(0);

    // Verify
    const verified = verifySOP(sampleGraph, sigResult.signature, pair.publicKey);
    expect(verified).toBe(true);

    // Build chain
    const chain = buildChainOfCustody(sampleGraph, [
      {
        id: 'round-trip-sig',
        signerId: 'tester',
        signature: sigResult.signature,
        publicKey: pair.publicKey,
        fingerprint: sigResult.fingerprint,
        signedAt: sigResult.signedAt,
      },
    ]);

    expect(chain).toHaveLength(1);
    expect(chain[0].verified).toBe(true);
    expect(chain[0].signatureId).toBe('round-trip-sig');
  });
});

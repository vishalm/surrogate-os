import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

const ALGORITHM = 'Ed25519';

export interface SOPSignatureResult {
  signature: string;
  signerPublicKey: string;
  signedAt: string;
  algorithm: string;
  fingerprint: string;
}

export interface ChainOfCustodyEntry {
  signatureId: string;
  signerId: string;
  signature: string;
  publicKey: string;
  fingerprint: string;
  signedAt: string;
  verified: boolean;
}

/**
 * Compute a deterministic SHA-256 fingerprint of a SOP graph using canonical JSON.
 * Keys are sorted to ensure deterministic output regardless of insertion order.
 */
export function computeSOPFingerprint(sopGraph: Record<string, unknown>): string {
  const canonical = canonicalStringify(sopGraph);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Recursively sort object keys for deterministic JSON serialization.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(
    (key) => JSON.stringify(key) + ':' + canonicalStringify(obj[key]),
  );
  return '{' + entries.join(',') + '}';
}

/**
 * Generate a new Ed25519 key pair for SOP signing.
 * Returns PEM-encoded keys.
 */
export function generateSigningKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

/**
 * Sign a SOP graph with a signer's Ed25519 private key.
 * The signature covers the canonical JSON fingerprint of the graph.
 */
export function signSOP(
  sopGraph: Record<string, unknown>,
  signerPrivateKey: string,
): SOPSignatureResult {
  const fingerprint = computeSOPFingerprint(sopGraph);
  const data = Buffer.from(fingerprint, 'utf-8');

  const signature = sign(null, data, signerPrivateKey);

  // Derive the public key from the private key
  const pubKeyObj = createPublicKey(signerPrivateKey);
  const signerPublicKey = pubKeyObj.export({ type: 'spki', format: 'pem' }) as string;

  return {
    signature: signature.toString('base64'),
    signerPublicKey,
    signedAt: new Date().toISOString(),
    algorithm: ALGORITHM,
    fingerprint,
  };
}

/**
 * Verify a SOP graph signature against a public key.
 */
export function verifySOP(
  sopGraph: Record<string, unknown>,
  signature: string,
  signerPublicKey: string,
): boolean {
  try {
    const fingerprint = computeSOPFingerprint(sopGraph);
    const data = Buffer.from(fingerprint, 'utf-8');
    const sigBuffer = Buffer.from(signature, 'base64');

    return verify(null, data, signerPublicKey, sigBuffer);
  } catch {
    return false;
  }
}

/**
 * Build a chain of custody from an ordered list of signatures,
 * verifying each against the provided SOP graph.
 */
export function buildChainOfCustody(
  sopGraph: Record<string, unknown>,
  signatures: {
    id: string;
    signerId: string;
    signature: string;
    publicKey: string;
    fingerprint: string;
    signedAt: string;
  }[],
): ChainOfCustodyEntry[] {
  return signatures.map((sig) => ({
    signatureId: sig.id,
    signerId: sig.signerId,
    signature: sig.signature,
    publicKey: sig.publicKey,
    fingerprint: sig.fingerprint,
    signedAt: sig.signedAt,
    verified: verifySOP(sopGraph, sig.signature, sig.publicKey),
  }));
}

import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  computeAuditHash,
  type TokenPayload,
} from './crypto.js';

const samplePayload: TokenPayload = {
  userId: 'user-123',
  orgId: 'org-456',
  orgSlug: 'test-org',
  role: 'MEMBER',
};

describe('hashPassword', () => {
  it('produces a bcrypt hash different from the input', async () => {
    const password = 'my-secret-password';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
  });

  it('produces different hashes for the same password (salted)', async () => {
    const password = 'same-password';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('returns true for the correct password', async () => {
    const password = 'correct-password';
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });
});

describe('generateTokens', () => {
  it('returns accessToken and refreshToken strings', () => {
    const tokens = generateTokens(samplePayload);
    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
    expect(tokens.accessToken.length).toBeGreaterThan(0);
    expect(tokens.refreshToken.length).toBeGreaterThan(0);
  });

  it('produces different access and refresh tokens', () => {
    const tokens = generateTokens(samplePayload);
    expect(tokens.accessToken).not.toBe(tokens.refreshToken);
  });
});

describe('verifyAccessToken', () => {
  it('successfully decodes a valid access token', () => {
    const { accessToken } = generateTokens(samplePayload);
    const decoded = verifyAccessToken(accessToken);
    expect(decoded.userId).toBe(samplePayload.userId);
    expect(decoded.orgId).toBe(samplePayload.orgId);
    expect(decoded.orgSlug).toBe(samplePayload.orgSlug);
    expect(decoded.role).toBe(samplePayload.role);
    expect(decoded.type).toBe('access');
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  it('throws for an invalid token string', () => {
    expect(() => verifyAccessToken('not-a-valid-token')).toThrow(
      'Invalid or expired access token',
    );
  });

  it('throws when a refresh token is used as an access token', () => {
    const { refreshToken } = generateTokens(samplePayload);
    expect(() => verifyAccessToken(refreshToken)).toThrow('Invalid token type');
  });
});

describe('verifyRefreshToken', () => {
  it('successfully decodes a valid refresh token', () => {
    const { refreshToken } = generateTokens(samplePayload);
    const decoded = verifyRefreshToken(refreshToken);
    expect(decoded.userId).toBe(samplePayload.userId);
    expect(decoded.orgId).toBe(samplePayload.orgId);
    expect(decoded.type).toBe('refresh');
  });

  it('throws for an invalid token string', () => {
    expect(() => verifyRefreshToken('garbage')).toThrow(
      'Invalid or expired refresh token',
    );
  });

  it('throws when an access token is used as a refresh token', () => {
    const { accessToken } = generateTokens(samplePayload);
    expect(() => verifyRefreshToken(accessToken)).toThrow('Invalid token type');
  });
});

describe('computeAuditHash', () => {
  const timestamp = new Date('2025-01-01T00:00:00.000Z');

  it('returns a consistent SHA-256 hex string', () => {
    const hash1 = computeAuditHash('prev-hash', 'ACTION', timestamp, 'surrogate-1');
    const hash2 = computeAuditHash('prev-hash', 'ACTION', timestamp, 'surrogate-1');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = computeAuditHash('prev-hash', 'ACTION_A', timestamp, 'surrogate-1');
    const hash2 = computeAuditHash('prev-hash', 'ACTION_B', timestamp, 'surrogate-1');
    expect(hash1).not.toBe(hash2);
  });

  it('handles null previousHash by substituting GENESIS', () => {
    const hashWithNull = computeAuditHash(null, 'ACTION', timestamp, 'surrogate-1');
    const hashWithGenesis = computeAuditHash('GENESIS', 'ACTION', timestamp, 'surrogate-1');
    // null previousHash uses 'GENESIS' as the placeholder, so these should match
    expect(hashWithNull).toBe(hashWithGenesis);
  });

  it('handles null surrogateId by substituting SYSTEM', () => {
    const hashWithNull = computeAuditHash('prev', 'ACTION', timestamp, null);
    const hashWithSystem = computeAuditHash('prev', 'ACTION', timestamp, 'SYSTEM');
    expect(hashWithNull).toBe(hashWithSystem);
  });

  it('produces a 64-character hex string', () => {
    const hash = computeAuditHash(null, 'TEST', timestamp, null);
    expect(hash).toHaveLength(64);
  });
});

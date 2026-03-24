import type { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

const KEY_PREFIX_LIVE = 'sos_live_';
const KEY_PREFIX_TEST = 'sos_test_';
const KEY_RANDOM_BYTES = 32;

interface ApiKeyResult {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

interface ApiKeyWithRaw extends ApiKeyResult {
  rawKey: string;
}

interface ValidatedKeyContext {
  orgId: string;
  keyId: string;
  scopes: string[];
}

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

function generateRawKey(isTest = false): string {
  const prefix = isTest ? KEY_PREFIX_TEST : KEY_PREFIX_LIVE;
  const random = randomBytes(KEY_RANDOM_BYTES).toString('hex');
  return `${prefix}${random}`;
}

function mapApiKeyRow(row: {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}): ApiKeyResult {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export class ApiKeyService {
  constructor(private readonly prisma: PrismaClient) {}

  async createApiKey(
    orgId: string,
    name: string,
    scopes: string[],
    expiresAt: Date | null,
    userId: string,
    isTest = false,
  ): Promise<ApiKeyWithRaw> {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('API key name is required');
    }

    const rawKey = generateRawKey(isTest);
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12) + '...';

    const row = await this.prisma.apiKey.create({
      data: {
        orgId,
        name: name.trim(),
        keyHash,
        keyPrefix,
        scopes,
        expiresAt,
        createdBy: userId,
      },
    });

    return {
      ...mapApiKeyRow(row),
      rawKey,
    };
  }

  async listApiKeys(orgId: string): Promise<ApiKeyResult[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(mapApiKeyRow);
  }

  async revokeApiKey(orgId: string, keyId: string, _userId: string): Promise<ApiKeyResult> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, orgId },
    });

    if (!existing) {
      throw new NotFoundError('API key not found');
    }

    if (existing.revokedAt) {
      throw new ValidationError('API key is already revoked');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return mapApiKeyRow(updated);
  }

  async validateApiKey(rawKey: string): Promise<ValidatedKeyContext | null> {
    const keyHash = hashKey(rawKey);

    const key = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
      },
    });

    if (!key) return null;

    // Check expiry
    if (key.expiresAt && key.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp (fire and forget)
    this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return {
      orgId: key.orgId,
      keyId: key.id,
      scopes: key.scopes,
    };
  }

  async rotateApiKey(
    orgId: string,
    keyId: string,
    userId: string,
    isTest = false,
  ): Promise<ApiKeyWithRaw> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, orgId },
    });

    if (!existing) {
      throw new NotFoundError('API key not found');
    }

    if (existing.revokedAt) {
      throw new ValidationError('Cannot rotate a revoked API key');
    }

    // Revoke the old key
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    // Create a new key with the same name and scopes
    return this.createApiKey(
      orgId,
      existing.name,
      existing.scopes,
      existing.expiresAt,
      userId,
      isTest,
    );
  }
}

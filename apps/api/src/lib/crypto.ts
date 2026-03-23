import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { config } from '../config/index.js';
import { UnauthorizedError } from './errors.js';

const BCRYPT_ROUNDS = 12;

export interface TokenPayload {
  userId: string;
  orgId: string;
  orgSlug: string;
  role: string;
}

export interface DecodedAccessToken extends TokenPayload {
  iat: number;
  exp: number;
  type: 'access';
}

export interface DecodedRefreshToken extends TokenPayload {
  iat: number;
  exp: number;
  type: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTokens(payload: TokenPayload): TokenPair {
  const accessToken = jwt.sign(
    { ...payload, type: 'access' },
    config.JWT_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'] },
  );

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.JWT_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'] },
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): DecodedAccessToken {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as DecodedAccessToken;
    if (decoded.type !== 'access') {
      throw new UnauthorizedError('Invalid token type');
    }
    return decoded;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): DecodedRefreshToken {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as DecodedRefreshToken;
    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Invalid token type');
    }
    return decoded;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}

export function computeAuditHash(
  previousHash: string | null,
  action: string,
  timestamp: Date,
  surrogateId: string | null,
): string {
  const data = [
    previousHash ?? 'GENESIS',
    action,
    timestamp.toISOString(),
    surrogateId ?? 'SYSTEM',
  ].join('|');

  return createHash('sha256').update(data).digest('hex');
}

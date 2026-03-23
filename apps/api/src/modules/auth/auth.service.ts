import type { PrismaClient } from '@prisma/client';
import { UserRole, OrgPlan } from '@surrogate-os/shared';
import {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyRefreshToken,
  type TokenPair,
} from '../../lib/crypto.js';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  orgName: string;
  orgSlug: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface InviteMemberInput {
  email: string;
  name: string;
  role?: UserRole;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  org: {
    id: string;
    name: string;
    slug: string;
  };
  tokens: TokenPair;
}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    // Check if org slug already exists
    const existingOrg = await this.prisma.org.findUnique({
      where: { slug: input.orgSlug },
    });
    if (existingOrg) {
      throw new ConflictError('An organization with this slug already exists');
    }

    const passwordHash = await hashPassword(input.password);

    // Create the tenant schema name
    const schemaName = `tenant_${input.orgSlug.replace(/-/g, '_')}`;

    // Create org and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.org.create({
        data: {
          name: input.orgName,
          slug: input.orgSlug,
          plan: OrgPlan.STUDIO,
          schemaName,
        },
      });

      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          orgId: org.id,
          role: UserRole.OWNER,
        },
      });

      return { org, user };
    });

    // Create the tenant schema (outside the transaction since it's DDL)
    await this.tenantManager.createTenantSchema(input.orgSlug);

    // Generate tokens
    const tokens = generateTokens({
      userId: result.user.id,
      orgId: result.org.id,
      orgSlug: result.org.slug,
      role: result.user.role,
    });

    // Store refresh token
    await this.prisma.user.update({
      where: { id: result.user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role as UserRole,
      },
      org: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
      },
      tokens,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { org: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordValid = await verifyPassword(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = generateTokens({
      userId: user.id,
      orgId: user.org.id,
      orgSlug: user.org.slug,
      role: user.role,
    });

    // Rotate refresh token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
      },
      org: {
        id: user.org.id,
        name: user.org.name,
        slug: user.org.slug,
      },
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { org: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Verify the refresh token matches what we stored (rotation check)
    if (user.refreshToken !== refreshToken) {
      // Potential token reuse detected — invalidate all sessions
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: null },
      });
      throw new UnauthorizedError('Refresh token has been revoked');
    }

    const tokens = generateTokens({
      userId: user.id,
      orgId: user.org.id,
      orgSlug: user.org.slug,
      role: user.role,
    });

    // Rotate refresh token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return tokens;
  }

  async inviteMember(
    orgId: string,
    input: InviteMemberInput,
  ): Promise<{ id: string; email: string; name: string; role: UserRole }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    const role = input.role ?? UserRole.MEMBER;

    if (role === UserRole.OWNER) {
      throw new ValidationError('Cannot invite a user as OWNER');
    }

    // Generate a temporary password — in production, send an invite email instead
    const tempPassword = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await hashPassword(tempPassword);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        orgId,
        role,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
    };
  }
}

import type { PrismaClient } from '@prisma/client';
import { UserRole } from '@surrogate-os/shared';
import type { UpdateOrgInput } from '@surrogate-os/shared';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';

export interface OrgResult {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberResult {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export class OrgService {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrg(orgId: string): Promise<OrgResult> {
    const org = await this.prisma.org.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      settings: org.settings,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async updateOrg(orgId: string, input: UpdateOrgInput): Promise<OrgResult> {
    const org = await this.prisma.org.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const updated = await this.prisma.org.update({
      where: { id: orgId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.plan !== undefined && { plan: input.plan }),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      plan: updated.plan,
      settings: updated.settings,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async getMembers(orgId: string): Promise<MemberResult[]> {
    const users = await this.prisma.user.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserRole,
      createdAt: u.createdAt,
    }));
  }

  async removeMember(
    orgId: string,
    memberId: string,
    requestingUserId: string,
  ): Promise<void> {
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!member || member.orgId !== orgId) {
      throw new NotFoundError('Member not found in this organization');
    }

    if (member.id === requestingUserId) {
      throw new ForbiddenError('Cannot remove yourself from the organization');
    }

    if (member.role === UserRole.OWNER) {
      throw new ForbiddenError('Cannot remove the organization owner');
    }

    await this.prisma.user.delete({
      where: { id: memberId },
    });
  }
}

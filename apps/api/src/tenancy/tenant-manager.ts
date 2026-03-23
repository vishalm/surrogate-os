import type { PrismaClient } from '@prisma/client';
import { InternalError, ValidationError } from '../lib/errors.js';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new ValidationError('Invalid org slug format. Only lowercase alphanumeric characters and hyphens allowed.', {
      slug,
    });
  }
}

function toSchemaName(orgSlug: string): string {
  // Convert hyphens to underscores for valid PostgreSQL schema name
  return `tenant_${orgSlug.replace(/-/g, '_')}`;
}

export class TenantManager {
  constructor(private readonly prisma: PrismaClient) {}

  async createTenantSchema(orgSlug: string): Promise<string> {
    validateSlug(orgSlug);
    const schemaName = toSchemaName(orgSlug);

    try {
      // Create the schema
      await this.prisma.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
      );

      // Create surrogates table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".surrogates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          role_title TEXT NOT NULL,
          domain TEXT NOT NULL,
          jurisdiction TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          config JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      // Create sops table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".sops (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          surrogate_id UUID REFERENCES "${schemaName}".surrogates(id),
          version INT NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          title TEXT NOT NULL,
          description TEXT,
          graph JSONB NOT NULL DEFAULT '{}',
          certified_by TEXT,
          hash TEXT NOT NULL,
          previous_version_id UUID,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      // Create audit_entries table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".audit_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          surrogate_id UUID,
          user_id UUID,
          action TEXT NOT NULL,
          details JSONB DEFAULT '{}',
          rationale TEXT,
          confidence FLOAT,
          human_auth_required BOOLEAN DEFAULT false,
          human_auth_granted_by UUID,
          previous_hash TEXT,
          hash TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      // Create indexes
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_audit_entries_created_at
          ON "${schemaName}".audit_entries(created_at)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_audit_entries_surrogate_id
          ON "${schemaName}".audit_entries(surrogate_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_audit_entries_action
          ON "${schemaName}".audit_entries(action)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_surrogates_status
          ON "${schemaName}".surrogates(status)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_sops_surrogate_id
          ON "${schemaName}".sops(surrogate_id)
      `);

      return schemaName;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new InternalError(`Failed to create tenant schema: ${(error as Error).message}`, {
        orgSlug,
        schemaName,
      });
    }
  }

  /**
   * Returns a function that executes raw SQL queries scoped to the tenant schema.
   * Uses SET search_path to scope queries to the correct tenant.
   */
  async getTenantConnection(orgSlug: string): Promise<{
    query: <T = unknown>(sql: string, params?: unknown[]) => Promise<T>;
    schemaName: string;
  }> {
    validateSlug(orgSlug);
    const schemaName = toSchemaName(orgSlug);

    const query = async <T = unknown>(sql: string, params?: unknown[]): Promise<T> => {
      await this.prisma.$executeRawUnsafe(
        `SET search_path TO "${schemaName}"`,
      );
      if (params && params.length > 0) {
        return this.prisma.$queryRawUnsafe(sql, ...params) as Promise<T>;
      }
      return this.prisma.$queryRawUnsafe(sql) as Promise<T>;
    };

    return { query, schemaName };
  }

  async dropTenantSchema(orgSlug: string): Promise<void> {
    validateSlug(orgSlug);
    const schemaName = toSchemaName(orgSlug);

    await this.prisma.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
    );
  }

  /**
   * Execute a raw query within a tenant's schema context.
   * Sets the search_path before executing the query.
   */
  async executeInTenant<T = unknown>(
    orgSlug: string,
    sql: string,
    params?: unknown[],
  ): Promise<T> {
    validateSlug(orgSlug);
    const schemaName = toSchemaName(orgSlug);

    await this.prisma.$executeRawUnsafe(
      `SET search_path TO "${schemaName}"`,
    );

    if (params && params.length > 0) {
      return this.prisma.$queryRawUnsafe(sql, ...params) as Promise<T>;
    }
    return this.prisma.$queryRawUnsafe(sql) as Promise<T>;
  }

  /**
   * Execute a raw statement (no result set) within a tenant's schema context.
   */
  async executeStatementInTenant(
    orgSlug: string,
    sql: string,
    params?: unknown[],
  ): Promise<number> {
    validateSlug(orgSlug);
    const schemaName = toSchemaName(orgSlug);

    await this.prisma.$executeRawUnsafe(
      `SET search_path TO "${schemaName}"`,
    );

    if (params && params.length > 0) {
      return this.prisma.$executeRawUnsafe(sql, ...params);
    }
    return this.prisma.$executeRawUnsafe(sql);
  }
}

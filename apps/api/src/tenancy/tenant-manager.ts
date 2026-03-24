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
      // Enable pgvector extension (idempotent)
      await this.prisma.$executeRawUnsafe(
        `CREATE EXTENSION IF NOT EXISTS vector`,
      );

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

      // Create sessions table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          surrogate_id UUID NOT NULL REFERENCES "${schemaName}".surrogates(id),
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          metadata JSONB DEFAULT '{}',
          started_at TIMESTAMPTZ DEFAULT now(),
          ended_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      // Create decision_outcomes table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".decision_outcomes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID NOT NULL REFERENCES "${schemaName}".sessions(id),
          surrogate_id UUID NOT NULL REFERENCES "${schemaName}".surrogates(id),
          sop_node_id TEXT,
          decision TEXT NOT NULL,
          outcome TEXT,
          confidence FLOAT,
          context JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      // Create debriefs table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".debriefs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID NOT NULL REFERENCES "${schemaName}".sessions(id),
          surrogate_id UUID NOT NULL REFERENCES "${schemaName}".surrogates(id),
          summary TEXT NOT NULL,
          decisions JSONB DEFAULT '[]',
          escalations JSONB DEFAULT '[]',
          edge_cases JSONB DEFAULT '[]',
          recommendations JSONB DEFAULT '[]',
          confidence FLOAT,
          generated_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      // Create sop_proposals table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".sop_proposals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sop_id UUID NOT NULL REFERENCES "${schemaName}".sops(id),
          surrogate_id UUID NOT NULL REFERENCES "${schemaName}".surrogates(id),
          proposed_by TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          current_graph JSONB NOT NULL,
          proposed_graph JSONB NOT NULL,
          diff JSONB DEFAULT '{}',
          rationale TEXT NOT NULL,
          reviewed_by TEXT,
          reviewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      // Create org_documents table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".org_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          mime_type TEXT NOT NULL DEFAULT 'text/plain',
          status TEXT NOT NULL DEFAULT 'PROCESSING',
          chunk_count INT NOT NULL DEFAULT 0,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      // Create document_chunks table (with pgvector embedding column)
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL REFERENCES "${schemaName}".org_documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          chunk_index INT NOT NULL,
          embedding vector(1536),
          metadata JSONB DEFAULT '{}'
        )
      `);

      // Create memory_entries table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".memory_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          surrogate_id UUID NOT NULL REFERENCES "${schemaName}".surrogates(id),
          type TEXT NOT NULL DEFAULT 'STM',
          source TEXT NOT NULL DEFAULT 'MANUAL',
          content TEXT NOT NULL,
          tags TEXT[] DEFAULT '{}',
          observation_count INT NOT NULL DEFAULT 1,
          first_observed_at TIMESTAMPTZ DEFAULT now(),
          last_observed_at TIMESTAMPTZ DEFAULT now(),
          expires_at TIMESTAMPTZ,
          promoted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      // Indexes for new tables
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_sessions_surrogate_id
          ON "${schemaName}".sessions(surrogate_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_sessions_status
          ON "${schemaName}".sessions(status)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_decision_outcomes_session_id
          ON "${schemaName}".decision_outcomes(session_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_decision_outcomes_surrogate_id
          ON "${schemaName}".decision_outcomes(surrogate_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_debriefs_session_id
          ON "${schemaName}".debriefs(session_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_debriefs_surrogate_id
          ON "${schemaName}".debriefs(surrogate_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_sop_proposals_sop_id
          ON "${schemaName}".sop_proposals(sop_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_sop_proposals_status
          ON "${schemaName}".sop_proposals(status)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_org_documents_status
          ON "${schemaName}".org_documents(status)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
          ON "${schemaName}".document_chunks(document_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_memory_entries_surrogate_id
          ON "${schemaName}".memory_entries(surrogate_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_memory_entries_type
          ON "${schemaName}".memory_entries(type)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_memory_entries_expires_at
          ON "${schemaName}".memory_entries(expires_at)
      `);

      // Create handoffs table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".handoffs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_surrogate_id UUID NOT NULL,
          target_surrogate_id UUID,
          target_human_id UUID,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'INITIATED',
          context_bundle JSONB NOT NULL DEFAULT '{}',
          summary TEXT,
          session_id UUID,
          initiated_by UUID NOT NULL,
          accepted_by UUID,
          initiated_at TIMESTAMPTZ DEFAULT now(),
          accepted_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_handoffs_source
          ON "${schemaName}".handoffs(source_surrogate_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_handoffs_target
          ON "${schemaName}".handoffs(target_surrogate_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_handoffs_status
          ON "${schemaName}".handoffs(status)
      `);

      // Create persona_templates table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".persona_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          domain TEXT NOT NULL,
          jurisdiction TEXT NOT NULL,
          base_config JSONB NOT NULL DEFAULT '{}',
          tags TEXT[] DEFAULT '{}',
          category TEXT,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          current_version TEXT NOT NULL DEFAULT '1.0.0',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_persona_templates_domain
          ON "${schemaName}".persona_templates(domain)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_persona_templates_status
          ON "${schemaName}".persona_templates(status)
      `);

      // Create persona_versions table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".persona_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_id UUID NOT NULL,
          version TEXT NOT NULL,
          config JSONB NOT NULL DEFAULT '{}',
          changelog TEXT,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(template_id, version)
        )
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_persona_versions_template
          ON "${schemaName}".persona_versions(template_id)
      `);

      // Create bias_checks table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".bias_checks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          surrogate_id UUID,
          status TEXT NOT NULL DEFAULT 'PENDING',
          analysis JSONB DEFAULT '{}',
          decision_sample_size INT NOT NULL DEFAULT 0,
          anomalies JSONB DEFAULT '[]',
          recommendations JSONB DEFAULT '[]',
          confidence FLOAT,
          triggered_by UUID NOT NULL,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_bias_checks_surrogate
          ON "${schemaName}".bias_checks(surrogate_id)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_bias_checks_status
          ON "${schemaName}".bias_checks(status)
      `);

      // Create humanoid_devices table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".humanoid_devices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          modality TEXT NOT NULL DEFAULT 'CHAT',
          status TEXT NOT NULL DEFAULT 'OFFLINE',
          hard_stop_config JSONB NOT NULL DEFAULT '{}',
          capabilities JSONB NOT NULL DEFAULT '[]',
          last_heartbeat TIMESTAMPTZ,
          metadata JSONB NOT NULL DEFAULT '{}',
          error_count INTEGER NOT NULL DEFAULT 0,
          uptime_seconds BIGINT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_humanoid_devices_status
          ON "${schemaName}".humanoid_devices(status)
      `);

      // Create executions table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".executions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID REFERENCES "${schemaName}".sessions(id),
          surrogate_id UUID NOT NULL REFERENCES "${schemaName}".surrogates(id),
          sop_id UUID NOT NULL REFERENCES "${schemaName}".sops(id),
          current_node_id TEXT NOT NULL,
          visited_nodes JSONB NOT NULL DEFAULT '[]',
          decisions JSONB NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'RUNNING',
          context JSONB NOT NULL DEFAULT '{}',
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_executions_status
          ON "${schemaName}".executions(status)
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_executions_surrogate
          ON "${schemaName}".executions(surrogate_id)
      `);

      // Create compliance_checks table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".compliance_checks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          surrogate_id UUID NOT NULL REFERENCES "${schemaName}".surrogates(id),
          framework_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          results JSONB NOT NULL DEFAULT '[]',
          passed INTEGER NOT NULL DEFAULT 0,
          failed INTEGER NOT NULL DEFAULT 0,
          score REAL,
          report JSONB,
          checked_by UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_compliance_checks_surrogate
          ON "${schemaName}".compliance_checks(surrogate_id)
      `);

      // Create sop_signatures table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".sop_signatures (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sop_id UUID NOT NULL REFERENCES "${schemaName}".sops(id),
          signer_id UUID NOT NULL,
          signature TEXT NOT NULL,
          public_key TEXT NOT NULL,
          algorithm TEXT NOT NULL DEFAULT 'Ed25519',
          fingerprint TEXT NOT NULL,
          signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_sop_signatures_sop
          ON "${schemaName}".sop_signatures(sop_id)
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

    // Use $transaction to ensure SET search_path and query run on the same connection
    // (Prisma connection pooling can use different connections otherwise)
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET search_path TO "${schemaName}"`,
      );

      if (params && params.length > 0) {
        return tx.$queryRawUnsafe(sql, ...params) as Promise<T>;
      }
      return tx.$queryRawUnsafe(sql) as Promise<T>;
    });
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

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET search_path TO "${schemaName}"`,
      );

      if (params && params.length > 0) {
        return tx.$executeRawUnsafe(sql, ...params);
      }
      return tx.$executeRawUnsafe(sql);
    });
  }
}

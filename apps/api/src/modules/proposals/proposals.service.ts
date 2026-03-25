import type { PrismaClient } from '@prisma/client';
import { AuditAction, ProposalStatus, sopGraphSchema } from '@surrogate-os/shared';
import type { SOPGraph } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ValidationError, InternalError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { getLLMSettings, callLLM } from '../../lib/llm-provider.js';
import { OrgService } from '../orgs/orgs.service.js';
import { SOPService } from '../sops/sops.service.js';
import { computeGraphDiff } from './graph-diff.js';
import {
  buildSOPImprovementSystemPrompt,
  buildSOPImprovementPrompt,
  buildSOPImprovementTool,
} from './prompts.js';

// ── Row types ────────────────────────────────────────────────────────

interface ProposalRow {
  id: string;
  sop_id: string;
  surrogate_id: string;
  proposed_by: string;
  status: string;
  current_graph: SOPGraph;
  proposed_graph: SOPGraph;
  diff: Record<string, unknown>;
  rationale: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

interface DebriefRow {
  id: string;
  session_id: string;
  surrogate_id: string;
  summary: string;
  decisions: Record<string, unknown>[];
  escalations: Record<string, unknown>[];
  edge_cases: Record<string, unknown>[];
  recommendations: Record<string, unknown>[];
}

interface SOPRow {
  id: string;
  surrogate_id: string;
  title: string;
  description: string | null;
  graph: SOPGraph;
}

interface CountRow {
  count: bigint;
}

// ── Row mapper ───────────────────────────────────────────────────────

function mapProposalRow(row: ProposalRow) {
  return {
    id: row.id,
    sopId: row.sop_id,
    surrogateId: row.surrogate_id,
    proposedBy: row.proposed_by,
    status: row.status,
    currentGraph: row.current_graph,
    proposedGraph: row.proposed_graph,
    diff: row.diff,
    rationale: row.rationale,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

interface SOPImprovementResult {
  title: string;
  description: string;
  graph: unknown;
  reasoning: string;
  changes: string[];
}

// ── Proposals Service ────────────────────────────────────────────────

export class ProposalService {
  private orgService: OrgService;
  private sopService: SOPService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {
    this.orgService = new OrgService(prisma);
    this.sopService = new SOPService(prisma, tenantManager);
  }

  // ── Proposal methods ─────────────────────────────────────────────

  async createFromDebrief(
    tenant: TenantContext,
    sopId: string,
    debriefId: string,
    userId: string,
  ) {
    // 1. Fetch current SOP
    const sop = await this.sopService.getById(tenant, sopId);
    const currentGraph = sop.graph as SOPGraph;

    // 2. Fetch debrief
    const debriefRows = await this.tenantManager.executeInTenant<DebriefRow[]>(
      tenant.orgSlug,
      `SELECT * FROM debriefs WHERE id = $1::uuid`,
      [debriefId],
    );
    if (debriefRows.length === 0) {
      throw new NotFoundError('Debrief not found');
    }
    const debrief = debriefRows[0];

    // 3. Call LLM to generate improved graph
    const llmSettings = await getLLMSettings(this.orgService, tenant.orgId);
    const systemPrompt = buildSOPImprovementSystemPrompt();
    const userPrompt = buildSOPImprovementPrompt({
      currentGraph,
      debriefData: {
        summary: debrief.summary,
        recommendations: debrief.recommendations,
        edgeCases: debrief.edge_cases,
        escalations: debrief.escalations,
      },
    });
    const tool = buildSOPImprovementTool();

    const result = await callLLM<SOPImprovementResult>(llmSettings, systemPrompt, userPrompt, tool);

    // 4. Sanitize and validate proposed graph
    const graph = result.graph as { nodes?: unknown[]; edges?: Array<{ condition?: unknown; [k: string]: unknown }> };
    if (graph?.edges) {
      for (const edge of graph.edges) {
        if (edge.condition !== undefined && edge.condition !== null && typeof edge.condition !== 'string') {
          edge.condition = JSON.stringify(edge.condition);
        }
      }
    }

    const graphParsed = sopGraphSchema.safeParse(graph);
    if (!graphParsed.success) {
      throw new InternalError(`LLM generated invalid SOP graph: ${graphParsed.error.message}`);
    }

    const proposedGraph = graphParsed.data as SOPGraph;

    // 5. Compute diff
    const diff = computeGraphDiff(currentGraph, proposedGraph);

    // 6. Insert proposal
    const rationale = `${result.reasoning}\n\nChanges:\n${result.changes.map((c) => `- ${c}`).join('\n')}`;
    const proposalRows = await this.tenantManager.executeInTenant<ProposalRow[]>(
      tenant.orgSlug,
      `INSERT INTO sop_proposals (sop_id, surrogate_id, proposed_by, status, current_graph, proposed_graph, diff, rationale)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
       RETURNING *`,
      [
        sopId,
        sop.surrogateId,
        userId,
        ProposalStatus.PENDING,
        JSON.stringify(currentGraph),
        JSON.stringify(proposedGraph),
        JSON.stringify(diff),
        rationale,
      ],
    );

    // 7. Audit
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: sop.surrogateId,
      userId,
      action: AuditAction.SOP_PROPOSAL_CREATED,
      details: { proposalId: proposalRows[0].id, sopId, debriefId, source: 'debrief' },
    });

    return mapProposalRow(proposalRows[0]);
  }

  async createManual(
    tenant: TenantContext,
    sopId: string,
    proposedGraph: SOPGraph,
    rationale: string,
    userId: string,
  ) {
    // Fetch current SOP
    const sop = await this.sopService.getById(tenant, sopId);
    const currentGraph = sop.graph as SOPGraph;

    // Compute diff
    const diff = computeGraphDiff(currentGraph, proposedGraph);

    // Insert proposal
    const proposalRows = await this.tenantManager.executeInTenant<ProposalRow[]>(
      tenant.orgSlug,
      `INSERT INTO sop_proposals (sop_id, surrogate_id, proposed_by, status, current_graph, proposed_graph, diff, rationale)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
       RETURNING *`,
      [
        sopId,
        sop.surrogateId,
        userId,
        ProposalStatus.PENDING,
        JSON.stringify(currentGraph),
        JSON.stringify(proposedGraph),
        JSON.stringify(diff),
        rationale,
      ],
    );

    // Audit
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: sop.surrogateId,
      userId,
      action: AuditAction.SOP_PROPOSAL_CREATED,
      details: { proposalId: proposalRows[0].id, sopId, source: 'manual' },
    });

    return mapProposalRow(proposalRows[0]);
  }

  async listProposals(
    tenant: TenantContext,
    pagination: PaginationParams,
    filters?: { sopId?: string; status?: string },
  ) {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.sopId) {
      whereClauses.push(`sop_id = $${paramIndex++}::uuid`);
      params.push(filters.sopId);
    }
    if (filters?.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM sop_proposals ${where}`,
      params,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<ProposalRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sop_proposals ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapProposalRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getProposal(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<ProposalRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sop_proposals WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Proposal not found');
    }

    return mapProposalRow(rows[0]);
  }

  async reviewProposal(
    tenant: TenantContext,
    id: string,
    status: 'APPROVED' | 'REJECTED',
    userId: string,
  ) {
    const proposal = await this.getProposal(tenant, id);

    if (proposal.status !== ProposalStatus.PENDING) {
      throw new ValidationError(`Cannot review a proposal with status ${proposal.status}. Only PENDING proposals can be reviewed.`);
    }

    if (status === 'APPROVED') {
      // Create new SOP version with the proposed graph
      const sopRows = await this.tenantManager.executeInTenant<SOPRow[]>(
        tenant.orgSlug,
        `SELECT id, surrogate_id, title, description, graph FROM sops WHERE id = $1::uuid`,
        [proposal.sopId],
      );
      if (sopRows.length === 0) {
        throw new NotFoundError('Associated SOP not found');
      }
      const sop = sopRows[0];

      await this.sopService.createVersion(
        tenant,
        proposal.sopId,
        {
          surrogateId: sop.surrogate_id,
          title: sop.title,
          description: sop.description ?? '',
          graph: proposal.proposedGraph,
        },
        userId,
      );

      // Set this proposal to APPROVED
      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `UPDATE sop_proposals SET status = $1, reviewed_by = $2::uuid, reviewed_at = NOW() WHERE id = $3::uuid`,
        [ProposalStatus.APPROVED, userId, id],
      );

      // Set other PENDING proposals for the same SOP to SUPERSEDED
      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `UPDATE sop_proposals SET status = $1 WHERE sop_id = $2::uuid AND status = $3 AND id != $4::uuid`,
        [ProposalStatus.SUPERSEDED, proposal.sopId, ProposalStatus.PENDING, id],
      );

      // Audit
      await createAuditEntry(this.tenantManager, tenant.orgSlug, {
        surrogateId: proposal.surrogateId,
        userId,
        action: AuditAction.SOP_PROPOSAL_APPROVED,
        details: { proposalId: id, sopId: proposal.sopId },
      });
    } else {
      // Rejected
      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `UPDATE sop_proposals SET status = $1, reviewed_by = $2::uuid, reviewed_at = NOW() WHERE id = $3::uuid`,
        [ProposalStatus.REJECTED, userId, id],
      );

      // Audit
      await createAuditEntry(this.tenantManager, tenant.orgSlug, {
        surrogateId: proposal.surrogateId,
        userId,
        action: AuditAction.SOP_PROPOSAL_REJECTED,
        details: { proposalId: id, sopId: proposal.sopId },
      });
    }

    // Return updated proposal
    return this.getProposal(tenant, id);
  }
}

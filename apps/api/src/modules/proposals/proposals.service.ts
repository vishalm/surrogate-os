import Anthropic from '@anthropic-ai/sdk';
import type { PrismaClient } from '@prisma/client';
import { AuditAction, ProposalStatus, sopGraphSchema } from '@surrogate-os/shared';
import type { SOPGraph } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ValidationError, InternalError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { OrgService } from '../orgs/orgs.service.js';
import { SOPService } from '../sops/sops.service.js';
import { config } from '../../config/index.js';
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

// ── LLM types (same pattern as debriefs.service.ts) ──────────────────

type LLMProvider = 'anthropic' | 'openai' | 'azure-openai' | 'ollama';

interface LLMSettings {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
  deploymentName?: string;
  maxTokens?: number;
  temperature?: number;
}

interface SOPImprovementResult {
  title: string;
  description: string;
  graph: unknown;
  reasoning: string;
  changes: string[];
}

// ── Provider-specific calls ──────────────────────────────────────────

async function callAnthropic(
  settings: LLMSettings,
  systemPrompt: string,
  userPrompt: string,
  tool: Anthropic.Tool,
): Promise<SOPImprovementResult> {
  const client = new Anthropic({ apiKey: settings.apiKey });
  const response = await client.messages.create({
    model: settings.model,
    max_tokens: settings.maxTokens ?? 4096,
    system: systemPrompt,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'improve_sop' },
    messages: [{ role: 'user', content: userPrompt }],
  });

  const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new InternalError('Anthropic did not return a tool use response');
  }

  return toolUseBlock.input as SOPImprovementResult;
}

async function callOpenAICompatible(
  settings: LLMSettings,
  systemPrompt: string,
  userPrompt: string,
  tool: Anthropic.Tool,
): Promise<SOPImprovementResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const isOllama = settings.provider === 'ollama';

  if (isOllama) {
    const jsonSchemaPrompt = `${systemPrompt}\n\nIMPORTANT: You MUST respond with ONLY valid JSON (no markdown, no explanation before/after). Use this exact schema:\n${JSON.stringify(tool.input_schema, null, 2)}`;

    const body = {
      model: settings.model,
      messages: [
        { role: 'system', content: jsonSchemaPrompt },
        { role: 'user', content: userPrompt },
      ],
      format: 'json',
      stream: false,
      options: { num_predict: settings.maxTokens ?? 4096, temperature: settings.temperature ?? 0.7 },
    };

    const ollamaURL = `${settings.endpoint ?? 'http://host.docker.internal:11434'}/api/chat`;
    const response = await fetch(ollamaURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalError(`Ollama API error (${response.status}): ${errorText.substring(0, 300)}`);
    }

    const json = await response.json() as { message?: { content: string } };
    const content = json.message?.content;
    if (!content) throw new InternalError('Ollama returned empty response');

    try {
      return JSON.parse(content);
    } catch {
      throw new InternalError(`Ollama returned invalid JSON: ${content.substring(0, 200)}`);
    }
  }

  // OpenAI / Azure OpenAI
  let baseURL: string;
  if (settings.provider === 'azure-openai') {
    const apiVersion = settings.apiVersion ?? '2024-02-01';
    baseURL = `${settings.endpoint}/openai/deployments/${settings.deploymentName}/chat/completions?api-version=${apiVersion}`;
    headers['api-key'] = settings.apiKey!;
  } else {
    baseURL = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  const openaiTool = {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.input_schema,
    },
  };

  const body = {
    model: settings.model,
    max_tokens: settings.maxTokens ?? 4096,
    temperature: settings.temperature ?? 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    tools: [openaiTool],
    tool_choice: { type: 'function', function: { name: 'improve_sop' } },
  };

  const response = await fetch(baseURL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new InternalError(`${settings.provider} API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const json = await response.json() as {
    choices: { message: { tool_calls?: { function: { arguments: string } }[] } }[];
  };

  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new InternalError(`${settings.provider} did not return a tool call response`);
  }

  return JSON.parse(toolCall.function.arguments);
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

  // ── LLM settings resolution ──────────────────────────────────────

  private async getLLMSettings(orgId: string): Promise<LLMSettings> {
    const settings = await this.orgService.getRawSettings(orgId);

    const provider = (settings.llmProvider as LLMProvider) ?? 'anthropic';
    const model = (settings.llmModel as string) || config.ANTHROPIC_MODEL;
    const apiKey = (settings.llmApiKey as string) || config.ANTHROPIC_API_KEY;
    const endpoint = settings.llmEndpoint as string | undefined;
    const apiVersion = settings.llmApiVersion as string | undefined;
    const deploymentName = settings.llmDeploymentName as string | undefined;
    const maxTokens = settings.llmMaxTokens as number | undefined;
    const temperature = settings.llmTemperature as number | undefined;

    if (provider === 'anthropic' && !apiKey) {
      throw new InternalError('LLM service is not configured. Set your Anthropic API key in Settings.');
    }
    if (provider === 'ollama' && !endpoint) {
      throw new InternalError('Ollama requires an endpoint URL. Configure it in Settings.');
    }
    if (provider === 'azure-openai' && (!endpoint || !deploymentName)) {
      throw new InternalError('Azure OpenAI requires endpoint and deployment name. Configure in Settings.');
    }

    return { provider, model, apiKey, endpoint, apiVersion, deploymentName, maxTokens, temperature };
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
    const llmSettings = await this.getLLMSettings(tenant.orgId);
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

    let result: SOPImprovementResult;
    try {
      if (llmSettings.provider === 'anthropic') {
        result = await callAnthropic(llmSettings, systemPrompt, userPrompt, tool);
      } else {
        result = await callOpenAICompatible(llmSettings, systemPrompt, userPrompt, tool);
      }
    } catch (error) {
      if (error instanceof InternalError) throw error;
      const errMsg = error instanceof Error ? error.message : 'Unknown LLM error';
      throw new InternalError(`LLM call failed (${llmSettings.provider}): ${errMsg}`);
    }

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

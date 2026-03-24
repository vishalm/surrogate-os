import type { PrismaClient } from '@prisma/client';
import { sopGraphSchema } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { InternalError } from '../../lib/errors.js';
import { getLLMSettings, callLLM, LLM_PROVIDERS } from '../../lib/llm-provider.js';
import type { LLMProvider, LLMSettings } from '../../lib/llm-provider.js';
import { OrgService } from '../orgs/orgs.service.js';
import { SOPService } from '../sops/sops.service.js';
import { SurrogateService } from '../surrogates/surrogates.service.js';
import { validateSOPGraph, computeGraphConfidence } from './graph-validator.js';
import { buildSystemPrompt, buildSOPGenerationPrompt, buildSOPTool } from './prompts.js';

// Re-export for backward compatibility
export { LLM_PROVIDERS };
export type { LLMProvider, LLMSettings };

// ── Main LLM Service ─────────────────────────────────────────────────
export class LLMService {
  private surrogateService: SurrogateService;
  private sopService: SOPService;
  private orgService: OrgService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {
    this.surrogateService = new SurrogateService(prisma, tenantManager);
    this.sopService = new SOPService(prisma, tenantManager);
    this.orgService = new OrgService(prisma);
  }

  async generateSOP(
    tenant: TenantContext,
    surrogateId: string,
    userId: string,
    options?: { additionalContext?: string },
  ) {
    // 1. Fetch surrogate details
    const surrogate = await this.surrogateService.getById(tenant, surrogateId);

    // 2. Fetch existing SOPs for context
    const existingSOPs = await this.sopService.listAll(tenant, { skip: 0, take: 100, page: 1, pageSize: 100 }, { surrogateId });
    const existingTitles = existingSOPs.data.map((s) => s.title);

    // 3. Build prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildSOPGenerationPrompt({
      roleTitle: surrogate.roleTitle,
      domain: surrogate.domain,
      jurisdiction: surrogate.jurisdiction,
      config: surrogate.config as Record<string, unknown> | undefined,
      existingSOPTitles: existingTitles,
      additionalContext: options?.additionalContext,
    });

    // 4. Resolve LLM provider settings
    const llmSettings = await getLLMSettings(this.orgService, tenant.orgId);
    const tool = buildSOPTool();

    // 5. Call the LLM
    const rawResult = await callLLM<{ title: string; description: string; graph: unknown; reasoning: string }>(
      llmSettings, systemPrompt, userPrompt, tool,
    );

    // 6. Sanitize LLM output (smaller models may not follow schema exactly)
    const graph = rawResult.graph as { nodes?: unknown[]; edges?: Array<{ condition?: unknown; [k: string]: unknown }> };
    if (graph?.edges) {
      for (const edge of graph.edges) {
        // Coerce non-string condition fields to strings
        if (edge.condition !== undefined && edge.condition !== null && typeof edge.condition !== 'string') {
          edge.condition = JSON.stringify(edge.condition);
        }
      }
    }

    // 7. Validate graph schema
    const graphParsed = sopGraphSchema.safeParse(graph);
    if (!graphParsed.success) {
      throw new InternalError(`LLM generated invalid SOP graph: ${graphParsed.error.message}`);
    }

    // 8. Validate graph structure
    const validation = validateSOPGraph(graphParsed.data);

    // 9. Compute confidence
    const confidence = computeGraphConfidence(graphParsed.data, validation);

    // 10. Persist as DRAFT SOP
    const sop = await this.sopService.create(tenant, {
      surrogateId,
      title: rawResult.title,
      description: rawResult.description,
      graph: graphParsed.data,
    }, userId);

    return { sop, confidence, reasoning: rawResult.reasoning, validation };
  }
}

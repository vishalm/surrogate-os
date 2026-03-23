import Anthropic from '@anthropic-ai/sdk';
import type { PrismaClient } from '@prisma/client';
import { AuditAction, sopGraphSchema } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { InternalError } from '../../lib/errors.js';
import { config } from '../../config/index.js';
import { SOPService } from '../sops/sops.service.js';
import { SurrogateService } from '../surrogates/surrogates.service.js';
import { validateSOPGraph, computeGraphConfidence } from './graph-validator.js';
import { buildSystemPrompt, buildSOPGenerationPrompt, buildSOPTool } from './prompts.js';

export interface GenerateSOPResult {
  sop: ReturnType<Awaited<ReturnType<SOPService['create']>> extends infer R ? () => R : never>;
  confidence: number;
  reasoning: string;
  validation: { valid: boolean; errors: string[] };
}

export class LLMService {
  private client: Anthropic;
  private surrogateService: SurrogateService;
  private sopService: SOPService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {
    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    this.surrogateService = new SurrogateService(prisma, tenantManager);
    this.sopService = new SOPService(prisma, tenantManager);
  }

  async generateSOP(
    tenant: TenantContext,
    surrogateId: string,
    userId: string,
    options?: { additionalContext?: string },
  ) {
    // 1. Fetch surrogate details
    const surrogate = await this.surrogateService.getById(tenant, surrogateId);

    // 2. Fetch existing SOPs for context (avoid duplicates)
    const existingSOPs = await this.sopService.listAll(tenant, { skip: 0, take: 100, page: 1, pageSize: 100 }, { surrogateId });
    const existingTitles = existingSOPs.data.map((s) => s.title);

    // 3. Build prompt
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildSOPGenerationPrompt({
      roleTitle: surrogate.roleTitle,
      domain: surrogate.domain,
      jurisdiction: surrogate.jurisdiction,
      config: surrogate.config as Record<string, unknown> | undefined,
      existingSOPTitles: existingTitles,
      additionalContext: options?.additionalContext,
    });

    // 4. Call Claude with tool-use
    const tool = buildSOPTool();
    let response: Anthropic.Message;

    try {
      response = await this.client.messages.create({
        model: config.ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'create_sop' },
        messages: [{ role: 'user', content: userPrompt }],
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown LLM error';
      throw new InternalError(`LLM call failed: ${errMsg}`);
    }

    // 5. Extract tool use result
    const toolUseBlock = response.content.find((block) => block.type === 'tool_use');
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      throw new InternalError('LLM did not return a tool use response');
    }

    const rawResult = toolUseBlock.input as {
      title: string;
      description: string;
      graph: { nodes: unknown[]; edges: unknown[] };
      reasoning: string;
    };

    // 6. Validate graph against Zod schema
    const graphParsed = sopGraphSchema.safeParse(rawResult.graph);
    if (!graphParsed.success) {
      throw new InternalError(`LLM generated invalid SOP graph: ${graphParsed.error.message}`);
    }

    // 7. Validate graph structure (DAG, escalation, checkpoint, etc.)
    const validation = validateSOPGraph(graphParsed.data);

    // 8. Compute confidence score
    const confidence = computeGraphConfidence(graphParsed.data, validation);

    // 9. Persist as DRAFT SOP
    const sop = await this.sopService.create(tenant, {
      surrogateId,
      title: rawResult.title,
      description: rawResult.description,
      graph: graphParsed.data,
    }, userId);

    return {
      sop,
      confidence,
      reasoning: rawResult.reasoning,
      validation,
    };
  }
}

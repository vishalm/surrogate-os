import type { PrismaClient } from '@prisma/client';
import type { PaginatedResponse } from '@surrogate-os/shared';
import { SOPStatus } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { getLLMSettings, callChatLLM } from '../../lib/llm-provider.js';
import { OrgService } from '../orgs/orgs.service.js';
import { SurrogateService } from '../surrogates/surrogates.service.js';
import { SOPService } from '../sops/sops.service.js';
import { MemoryService } from '../memory/memory.service.js';

// ── Row Types ────────────────────────────────────────────────────────

interface ConversationRow {
  id: string;
  surrogate_id: string;
  user_id: string;
  title: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface CountRow {
  count: bigint;
}

interface SurrogateRow {
  id: string;
  role_title: string;
  domain: string;
  jurisdiction: string;
  status: string;
  config: Record<string, unknown>;
}

// ── Row Mappers ──────────────────────────────────────────────────────

function mapConversationRow(row: ConversationRow) {
  return {
    id: row.id,
    surrogateId: row.surrogate_id,
    userId: row.user_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

// ── System Prompt Builder ────────────────────────────────────────────

function buildChatSystemPrompt(
  surrogate: {
    roleTitle: string;
    domain: string;
    jurisdiction: string;
    config: Record<string, unknown>;
  },
  sops: { title: string; description: string | null; graph: Record<string, unknown> }[],
  memories: { content: string; type: string }[],
): string {
  const config = surrogate.config ?? {};
  const personalityTraits: string[] = [];

  if (config.communicationStyle) {
    personalityTraits.push(`Communication style: ${config.communicationStyle}`);
  }
  if (config.assertiveness !== undefined) {
    personalityTraits.push(`Assertiveness: ${config.assertiveness}/10`);
  }
  if (config.empathyLevel !== undefined) {
    personalityTraits.push(`Empathy level: ${config.empathyLevel}/10`);
  }
  if (config.riskTolerance) {
    personalityTraits.push(`Risk tolerance: ${config.riskTolerance}`);
  }
  if (config.seniority) {
    personalityTraits.push(`Seniority: ${config.seniority}`);
  }
  if (config.certifications && Array.isArray(config.certifications) && config.certifications.length > 0) {
    personalityTraits.push(`Certifications: ${(config.certifications as string[]).join(', ')}`);
  }

  let prompt = `You are "${surrogate.roleTitle}", a professional surrogate operating in the "${surrogate.domain}" domain under "${surrogate.jurisdiction}" jurisdiction.

Your role is to act as this professional surrogate — providing guidance, making decisions, and answering questions exactly as someone in this role would. Stay in character at all times. Be helpful, professional, and grounded in your area of expertise.`;

  if (personalityTraits.length > 0) {
    prompt += `\n\n## Personality & Traits\n${personalityTraits.join('\n')}`;
  }

  if (sops.length > 0) {
    prompt += `\n\n## Standard Operating Procedures\nYou follow these certified SOPs:\n`;
    for (const sop of sops) {
      prompt += `\n### ${sop.title}`;
      if (sop.description) {
        prompt += `\n${sop.description}`;
      }
      // Include a summary of the graph nodes for context
      const graph = sop.graph as { nodes?: { id: string; label: string; type: string }[] };
      if (graph.nodes && graph.nodes.length > 0) {
        const nodesSummary = graph.nodes.map((n) => `- ${n.label} (${n.type})`).join('\n');
        prompt += `\nProcess steps:\n${nodesSummary}`;
      }
    }
  }

  if (memories.length > 0) {
    prompt += `\n\n## Relevant Memories & Context\n`;
    for (const mem of memories) {
      prompt += `- [${mem.type}] ${mem.content}\n`;
    }
  }

  prompt += `\n\n## Guidelines
- Answer questions and provide guidance consistent with your role, domain, and jurisdiction.
- Reference your SOPs when making decisions or giving procedural advice.
- Use your memories to inform context-aware responses.
- If a question falls outside your domain or jurisdiction, clearly state so and recommend escalation.
- Be concise but thorough. Prefer actionable advice.`;

  return prompt;
}

// ── Chat Service ─────────────────────────────────────────────────────

export class ChatService {
  private surrogateService: SurrogateService;
  private sopService: SOPService;
  private memoryService: MemoryService;
  private orgService: OrgService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {
    this.surrogateService = new SurrogateService(prisma, tenantManager);
    this.sopService = new SOPService(prisma, tenantManager);
    this.memoryService = new MemoryService(prisma, tenantManager);
    this.orgService = new OrgService(prisma);
  }

  async createConversation(
    tenant: TenantContext,
    surrogateId: string,
    userId: string,
  ) {
    // Verify the surrogate exists
    const surrogate = await this.surrogateService.getById(tenant, surrogateId);

    const rows = await this.tenantManager.executeInTenant<ConversationRow[]>(
      tenant.orgSlug,
      `INSERT INTO conversations (surrogate_id, user_id, title)
       VALUES ($1::uuid, $2::uuid, $3)
       RETURNING *`,
      [surrogateId, userId, `Chat with ${surrogate.roleTitle}`],
    );

    return mapConversationRow(rows[0]);
  }

  async sendMessage(
    tenant: TenantContext,
    conversationId: string,
    content: string,
    userId: string,
  ) {
    // 1. Verify conversation exists and belongs to user
    const conversation = await this.getConversationRow(tenant, conversationId);

    if (conversation.user_id !== userId) {
      throw new ForbiddenError('You do not have access to this conversation');
    }

    if (conversation.status !== 'ACTIVE') {
      throw new ForbiddenError('This conversation is no longer active');
    }

    // 2. Store user message
    const userMsgRows = await this.tenantManager.executeInTenant<MessageRow[]>(
      tenant.orgSlug,
      `INSERT INTO messages (conversation_id, role, content, metadata)
       VALUES ($1::uuid, 'user', $2, '{}'::jsonb)
       RETURNING *`,
      [conversationId, content],
    );

    // 3. Load surrogate config
    const surrogate = await this.surrogateService.getById(tenant, conversation.surrogate_id);

    // 4. Load relevant SOPs (certified ones for this surrogate)
    const sopsResult = await this.sopService.listAll(
      tenant,
      { skip: 0, take: 20, page: 1, pageSize: 20 },
      { surrogateId: conversation.surrogate_id, status: SOPStatus.CERTIFIED },
    );

    // 5. Load relevant memory entries
    const memories = await this.memoryService.getRelevantMemories(
      tenant,
      conversation.surrogate_id,
    );

    // 6. Build system prompt
    const systemPrompt = buildChatSystemPrompt(
      {
        roleTitle: surrogate.roleTitle,
        domain: surrogate.domain,
        jurisdiction: surrogate.jurisdiction,
        config: surrogate.config as Record<string, unknown>,
      },
      sopsResult.data.map((s) => ({
        title: s.title,
        description: s.description,
        graph: s.graph as Record<string, unknown>,
      })),
      memories.map((m) => ({ content: m.content, type: m.type })),
    );

    // 7. Load conversation history
    const historyRows = await this.tenantManager.executeInTenant<MessageRow[]>(
      tenant.orgSlug,
      `SELECT * FROM messages
       WHERE conversation_id = $1::uuid
       ORDER BY created_at ASC`,
      [conversationId],
    );

    // 8. Build messages array for LLM (include history)
    const llmMessages = historyRows.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // 9. Get org LLM settings and call LLM
    const llmSettings = await getLLMSettings(this.orgService, tenant.orgId);
    const aiResponse = await callChatLLM(llmSettings, systemPrompt, llmMessages);

    // 10. Store AI response message
    const aiMsgRows = await this.tenantManager.executeInTenant<MessageRow[]>(
      tenant.orgSlug,
      `INSERT INTO messages (conversation_id, role, content, metadata)
       VALUES ($1::uuid, 'assistant', $2, $3::jsonb)
       RETURNING *`,
      [
        conversationId,
        aiResponse,
        JSON.stringify({ provider: llmSettings.provider, model: llmSettings.model }),
      ],
    );

    // 11. Update conversation title on first message if still default
    if (historyRows.length <= 1) {
      const truncatedTitle = content.length > 60 ? content.substring(0, 57) + '...' : content;
      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `UPDATE conversations SET title = $1, updated_at = NOW()
         WHERE id = $2::uuid`,
        [truncatedTitle, conversationId],
      );
    } else {
      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `UPDATE conversations SET updated_at = NOW() WHERE id = $1::uuid`,
        [conversationId],
      );
    }

    return {
      userMessage: mapMessageRow(userMsgRows[0]),
      assistantMessage: mapMessageRow(aiMsgRows[0]),
    };
  }

  async listConversations(
    tenant: TenantContext,
    userId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<ReturnType<typeof mapConversationRow> & { surrogateName?: string; lastMessage?: string }>> {
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM conversations
       WHERE user_id = $1::uuid AND status = 'ACTIVE'`,
      [userId],
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<(ConversationRow & { surrogate_role_title: string; last_message: string | null })[]>(
      tenant.orgSlug,
      `SELECT c.*, s.role_title as surrogate_role_title,
              (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
       FROM conversations c
       JOIN surrogates s ON s.id = c.surrogate_id
       WHERE c.user_id = $1::uuid AND c.status = 'ACTIVE'
       ORDER BY c.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, pagination.take, pagination.skip],
    );

    const mapped = rows.map((row) => ({
      ...mapConversationRow(row),
      surrogateName: row.surrogate_role_title,
      lastMessage: row.last_message ?? undefined,
    }));

    return buildPaginatedResponse(mapped, total, pagination.page, pagination.pageSize);
  }

  async getConversation(
    tenant: TenantContext,
    conversationId: string,
  ) {
    const convRow = await this.getConversationRow(tenant, conversationId);

    // Get surrogate info
    const surrogate = await this.surrogateService.getById(tenant, convRow.surrogate_id);

    // Get all messages
    const messageRows = await this.tenantManager.executeInTenant<MessageRow[]>(
      tenant.orgSlug,
      `SELECT * FROM messages
       WHERE conversation_id = $1::uuid
       ORDER BY created_at ASC`,
      [conversationId],
    );

    return {
      ...mapConversationRow(convRow),
      surrogate: {
        id: surrogate.id,
        roleTitle: surrogate.roleTitle,
        domain: surrogate.domain,
        jurisdiction: surrogate.jurisdiction,
      },
      messages: messageRows.map(mapMessageRow),
    };
  }

  async deleteConversation(
    tenant: TenantContext,
    conversationId: string,
    userId: string,
  ) {
    const convRow = await this.getConversationRow(tenant, conversationId);

    if (convRow.user_id !== userId) {
      throw new ForbiddenError('You do not have access to this conversation');
    }

    // Soft delete
    await this.tenantManager.executeInTenant(
      tenant.orgSlug,
      `UPDATE conversations SET status = 'DELETED', updated_at = NOW()
       WHERE id = $1::uuid`,
      [conversationId],
    );
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private async getConversationRow(
    tenant: TenantContext,
    conversationId: string,
  ): Promise<ConversationRow> {
    const rows = await this.tenantManager.executeInTenant<ConversationRow[]>(
      tenant.orgSlug,
      `SELECT * FROM conversations WHERE id = $1::uuid`,
      [conversationId],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    return rows[0];
  }

}

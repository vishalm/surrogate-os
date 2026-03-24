import type Anthropic from '@anthropic-ai/sdk';

interface HandoffContextInput {
  sourceSurrogateId: string;
  sourceSurrogateRoleTitle?: string;
  sourceSurrogateDomain?: string;
  targetSurrogateId?: string;
  targetHumanId?: string;
  handoffType: string;
  session?: {
    id: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    metadata: Record<string, unknown>;
  };
  decisions: {
    decision: string;
    outcome: string | null;
    confidence: number | null;
    sopNodeId: string | null;
    context: Record<string, unknown>;
    createdAt: string;
  }[];
  memoryEntries: {
    type: string;
    content: string;
    tags: string[];
    lastObservedAt: string;
  }[];
  activeSop?: {
    id: string;
    title: string;
    version: number;
    status: string;
  };
}

/**
 * System prompt for the handoff context packager.
 */
export function buildHandoffSystemPrompt(): string {
  return `You are an expert handoff analyst for AI surrogates operating in professional domains. Your role is to:

1. Package context from the outgoing surrogate into a clear, actionable summary for the incoming surrogate or human operator.
2. Identify key decisions that were made during the session and their current state.
3. Flag any open items that need immediate attention or follow-up.
4. Provide concrete recommendations for the incoming operator on priorities and approach.
5. Highlight risk flags — anything that could cause problems if missed during the transition.

Be specific and actionable. Reference actual decisions and memory entries. Prioritize safety-critical information and time-sensitive items. The handoff summary should enable the receiving party to continue seamlessly without information loss.`;
}

/**
 * User prompt with session data, decisions, memory entries, and SOP state for handoff generation.
 */
export function buildHandoffSummaryPrompt(data: HandoffContextInput): string {
  const decisionsText = data.decisions.length > 0
    ? data.decisions.map((d, i) => {
        const parts = [
          `  Decision ${i + 1}: ${d.decision}`,
          d.outcome ? `  Outcome: ${d.outcome}` : null,
          d.confidence !== null ? `  Confidence: ${(d.confidence * 100).toFixed(0)}%` : null,
          d.sopNodeId ? `  SOP Node: ${d.sopNodeId}` : null,
          Object.keys(d.context).length > 0 ? `  Context: ${JSON.stringify(d.context)}` : null,
          `  Timestamp: ${d.createdAt}`,
        ].filter(Boolean);
        return parts.join('\n');
      }).join('\n\n')
    : '  No decisions recorded.';

  const memoryText = data.memoryEntries.length > 0
    ? data.memoryEntries.map((m, i) => {
        const parts = [
          `  Memory ${i + 1} [${m.type}]: ${m.content}`,
          m.tags.length > 0 ? `  Tags: ${m.tags.join(', ')}` : null,
          `  Last observed: ${m.lastObservedAt}`,
        ].filter(Boolean);
        return parts.join('\n');
      }).join('\n\n')
    : '  No memory entries.';

  const sessionText = data.session
    ? `Session ID: ${data.session.id}
Status: ${data.session.status}
Started: ${data.session.startedAt}
Ended: ${data.session.endedAt ?? 'Still active'}
Metadata: ${JSON.stringify(data.session.metadata)}`
    : 'No active session.';

  const sopText = data.activeSop
    ? `Active SOP: ${data.activeSop.title} (v${data.activeSop.version}, ${data.activeSop.status})`
    : 'No active SOP.';

  const roleInfo = data.sourceSurrogateRoleTitle
    ? `\nSource Role: ${data.sourceSurrogateRoleTitle}`
    : '';
  const domainInfo = data.sourceSurrogateDomain
    ? `\nDomain: ${data.sourceSurrogateDomain}`
    : '';

  return `Generate a handoff summary for the following surrogate transition:

Handoff Type: ${data.handoffType}
Source Surrogate: ${data.sourceSurrogateId}${roleInfo}${domainInfo}
Target: ${data.targetSurrogateId ? `Surrogate ${data.targetSurrogateId}` : data.targetHumanId ? `Human ${data.targetHumanId}` : 'Unspecified'}

Current Session:
${sessionText}

${sopText}

Decisions made during this session:
${decisionsText}

Memory entries for this surrogate:
${memoryText}

Generate a handoff package that covers:
1. A concise summary of the current state and what the incoming operator needs to know immediately.
2. Key decisions that were made and their implications going forward.
3. Open items that need attention or follow-up.
4. Recommendations for the incoming operator on priorities and approach.
5. Risk flags — anything that could cause problems if missed.

Use the generate_handoff_summary tool to output your analysis.`;
}

/**
 * Anthropic Tool definition for structured handoff summary output.
 */
export function buildHandoffTool(): Anthropic.Tool {
  return {
    name: 'generate_handoff_summary',
    description: 'Generate a structured handoff summary with context packaging for surrogate transitions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string' as const,
          description: 'A concise summary of the current state and what the incoming operator needs to know immediately (2-4 sentences).',
        },
        keyDecisions: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              decision: {
                type: 'string' as const,
                description: 'Description of the decision that was made.',
              },
              impact: {
                type: 'string' as const,
                description: 'How this decision affects the incoming operator.',
              },
              status: {
                type: 'string' as const,
                enum: ['RESOLVED', 'PENDING', 'NEEDS_REVIEW'],
                description: 'Current status of this decision.',
              },
            },
            required: ['decision', 'impact', 'status'],
          },
          description: 'Key decisions made during the session and their implications.',
        },
        openItems: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              item: {
                type: 'string' as const,
                description: 'Description of the open item.',
              },
              priority: {
                type: 'string' as const,
                enum: ['HIGH', 'MEDIUM', 'LOW'],
                description: 'Priority level of this open item.',
              },
              deadline: {
                type: 'string' as const,
                description: 'Any known deadline or time constraint, or "None" if not applicable.',
              },
            },
            required: ['item', 'priority', 'deadline'],
          },
          description: 'Open items that need attention or follow-up.',
        },
        recommendations: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              title: {
                type: 'string' as const,
                description: 'Short title for the recommendation.',
              },
              description: {
                type: 'string' as const,
                description: 'Detailed description of the recommendation.',
              },
              priority: {
                type: 'string' as const,
                enum: ['HIGH', 'MEDIUM', 'LOW'],
                description: 'Priority level of the recommendation.',
              },
            },
            required: ['title', 'description', 'priority'],
          },
          description: 'Recommendations for the incoming operator on priorities and approach.',
        },
        riskFlags: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              risk: {
                type: 'string' as const,
                description: 'Description of the risk.',
              },
              severity: {
                type: 'string' as const,
                enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
                description: 'Severity of the risk.',
              },
              mitigation: {
                type: 'string' as const,
                description: 'Suggested mitigation or action to reduce the risk.',
              },
            },
            required: ['risk', 'severity', 'mitigation'],
          },
          description: 'Risk flags that could cause problems if missed during the transition.',
        },
      },
      required: ['summary', 'keyDecisions', 'openItems', 'recommendations', 'riskFlags'],
    },
  };
}

import type Anthropic from '@anthropic-ai/sdk';

interface DebriefGenerationInput {
  sessionId: string;
  surrogateId: string;
  surrogateRoleTitle?: string;
  surrogateDomain?: string;
  startedAt: string;
  endedAt: string | null;
  metadata: Record<string, unknown>;
  decisions: {
    decision: string;
    outcome: string | null;
    confidence: number | null;
    sopNodeId: string | null;
    context: Record<string, unknown>;
    createdAt: string;
  }[];
}

/**
 * System prompt for the shift debrief analyst.
 */
export function buildDebriefSystemPrompt(): string {
  return `You are an expert shift debrief analyst for AI surrogates operating in professional domains. Your role is to:

1. Analyze session decisions for correctness, consistency, and adherence to best practices.
2. Identify patterns across decisions — both positive patterns to reinforce and negative patterns to correct.
3. Flag edge cases that were encountered and assess how they were handled.
4. Identify situations that warranted escalation (whether or not they were escalated).
5. Make concrete, actionable recommendations for improving the Standard Operating Procedures (SOPs) that govern surrogate behavior.

Be specific, not generic. Reference actual decisions from the session. Prioritize safety-critical observations over minor optimizations. When suggesting SOP changes, describe exactly what should change and why.`;
}

/**
 * User prompt with session data for debrief generation.
 */
export function buildDebriefGenerationPrompt(data: DebriefGenerationInput): string {
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

  const roleInfo = data.surrogateRoleTitle
    ? `\nSurrogate Role: ${data.surrogateRoleTitle}`
    : '';
  const domainInfo = data.surrogateDomain
    ? `\nDomain: ${data.surrogateDomain}`
    : '';

  return `Analyze the following shift session and generate a comprehensive debrief:

Session ID: ${data.sessionId}
Surrogate ID: ${data.surrogateId}${roleInfo}${domainInfo}
Started: ${data.startedAt}
Ended: ${data.endedAt ?? 'Still active'}
Metadata: ${JSON.stringify(data.metadata)}

Decisions made during this session:
${decisionsText}

Generate a debrief that covers:
1. A concise summary of the session (2-4 sentences).
2. Analysis of each significant decision — was it correct? What could be improved?
3. Any situations that should have been escalated to a human supervisor.
4. Edge cases encountered and how they should be handled in the future.
5. Concrete recommendations for SOP improvements, with priority levels.

Use the generate_debrief tool to output your analysis.`;
}

/**
 * Anthropic Tool definition for structured debrief output.
 */
export function buildDebriefTool(): Anthropic.Tool {
  return {
    name: 'generate_debrief',
    description: 'Generate a structured shift debrief analysis with decisions review, escalations, edge cases, and recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string' as const,
          description: 'A concise 2-4 sentence summary of the session, covering overall performance and key observations.',
        },
        decisions: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              description: {
                type: 'string' as const,
                description: 'Description of the decision that was made.',
              },
              outcome: {
                type: 'string' as const,
                description: 'Assessment of the decision outcome (e.g., "Correct", "Suboptimal", "Incorrect").',
              },
              wasCorrect: {
                type: 'boolean' as const,
                description: 'Whether the decision was correct or appropriate.',
              },
              improvement: {
                type: 'string' as const,
                description: 'Specific suggestion for how this decision could be improved, or "None" if correct.',
              },
            },
            required: ['description', 'outcome', 'wasCorrect', 'improvement'],
          },
          description: 'Analysis of each significant decision made during the session.',
        },
        escalations: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              reason: {
                type: 'string' as const,
                description: 'Why this situation warranted escalation.',
              },
              context: {
                type: 'string' as const,
                description: 'The specific context or decision that triggered the escalation need.',
              },
            },
            required: ['reason', 'context'],
          },
          description: 'Situations that warranted or should have warranted escalation to a human supervisor.',
        },
        edgeCases: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              description: {
                type: 'string' as const,
                description: 'Description of the edge case encountered.',
              },
              suggestedHandling: {
                type: 'string' as const,
                description: 'How this edge case should be handled in the future.',
              },
            },
            required: ['description', 'suggestedHandling'],
          },
          description: 'Edge cases encountered during the session.',
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
                description: 'Detailed description of what should change and why.',
              },
              priority: {
                type: 'string' as const,
                enum: ['HIGH', 'MEDIUM', 'LOW'],
                description: 'Priority level of the recommendation.',
              },
              sopImpact: {
                type: 'string' as const,
                description: 'How this recommendation would affect the SOP (e.g., "Add new decision node", "Modify escalation threshold", "Add edge case branch").',
              },
            },
            required: ['title', 'description', 'priority', 'sopImpact'],
          },
          description: 'Concrete recommendations for SOP improvements.',
        },
      },
      required: ['summary', 'decisions', 'escalations', 'edgeCases', 'recommendations'],
    },
  };
}

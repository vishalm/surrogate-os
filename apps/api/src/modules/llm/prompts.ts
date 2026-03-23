import type { SurrogateConfig } from '@surrogate-os/shared';
import { SOPNodeType } from '@surrogate-os/shared';

interface SOPGenerationInput {
  roleTitle: string;
  domain: string;
  jurisdiction: string;
  config?: Partial<SurrogateConfig>;
  existingSOPTitles: string[];
  additionalContext?: string;
}

/**
 * Build the system prompt for SOP generation.
 */
export function buildSystemPrompt(): string {
  return `You are an expert Standard Operating Procedure (SOP) architect. You design precise, actionable, regulatory-compliant SOPs for professional roles.

Your SOPs must be structured as directed acyclic graphs (DAGs) with typed nodes and conditional edges. Each SOP must include proper escalation paths and human checkpoint nodes.

You always produce SOPs that are realistic, detailed, and ready for expert review — not generic templates. You consider the specific domain, jurisdiction, and seniority level when designing procedures.`;
}

/**
 * Build the user prompt with role context for SOP generation.
 */
export function buildSOPGenerationPrompt(input: SOPGenerationInput): string {
  const configDetails = input.config
    ? `
Personality & Behavioral Configuration:
- Seniority: ${input.config.seniority ?? 'Not specified'}
- Risk Tolerance: ${input.config.riskTolerance ?? 'medium'}
- Escalation Threshold: ${input.config.escalationThreshold ?? 0.85}
- Assertiveness: ${input.config.assertiveness ?? 5}/10
- Empathy Level: ${input.config.empathyLevel ?? 5}/10
- Communication Style: ${input.config.communicationStyle ?? 'Professional'}
- Certifications: ${(input.config.certifications ?? []).join(', ') || 'None specified'}`
    : '';

  const existingSOPs =
    input.existingSOPTitles.length > 0
      ? `\n\nExisting SOPs for this role (DO NOT duplicate these):\n${input.existingSOPTitles.map((t) => `- ${t}`).join('\n')}`
      : '';

  const additionalCtx = input.additionalContext
    ? `\n\nAdditional Context from the operator:\n${input.additionalContext}`
    : '';

  return `Generate a Standard Operating Procedure (SOP) for the following professional role:

Role: ${input.roleTitle}
Domain: ${input.domain}
Jurisdiction: ${input.jurisdiction}
${configDetails}
${existingSOPs}
${additionalCtx}

Requirements:
1. The SOP should be realistic and specific to this role's domain and jurisdiction.
2. Include decision points with multiple outcomes (branching paths).
3. Include at least one ESCALATION node (when to hand off to a human supervisor).
4. Include at least one CHECKPOINT node (where human review is required before proceeding).
5. Node IDs should be descriptive (e.g., "assess-patient-vitals", "check-drug-interactions").
6. Edges should have meaningful conditions where applicable (e.g., "vitals_normal", "abnormal_reading").
7. The SOP should have 8-15 nodes for appropriate depth.
8. Consider the jurisdiction's regulatory requirements.

Use the create_sop tool to output the structured SOP.`;
}

/**
 * Build the tool definition for structured SOP output via Anthropic tool-use.
 */
export function buildSOPTool() {
  const nodeTypeValues = Object.values(SOPNodeType);

  return {
    name: 'create_sop' as const,
    description:
      'Create a structured Standard Operating Procedure with a graph of typed nodes and edges',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string' as const,
          description: 'A clear, descriptive title for the SOP (e.g., "Patient Triage Assessment")',
        },
        description: {
          type: 'string' as const,
          description: 'A 2-3 sentence description of what this SOP covers and when it applies',
        },
        graph: {
          type: 'object' as const,
          properties: {
            nodes: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  id: {
                    type: 'string' as const,
                    description: 'Unique kebab-case node ID (e.g., "assess-patient-vitals")',
                  },
                  type: {
                    type: 'string' as const,
                    enum: nodeTypeValues,
                    description: `Node type. Options: ${nodeTypeValues.map((t) => `${t} (${getNodeTypeDescription(t)})`).join(', ')}`,
                  },
                  label: {
                    type: 'string' as const,
                    description: 'Short display label for the node (1-5 words)',
                  },
                  description: {
                    type: 'string' as const,
                    description:
                      'Detailed description of what happens at this node (1-3 sentences)',
                  },
                  config: {
                    type: 'object' as const,
                    description: 'Optional configuration for this node',
                  },
                },
                required: ['id', 'type', 'label', 'description'],
              },
              minItems: 5,
            },
            edges: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  id: {
                    type: 'string' as const,
                    description: 'Unique edge ID (e.g., "edge-1")',
                  },
                  from: {
                    type: 'string' as const,
                    description: 'Source node ID',
                  },
                  to: {
                    type: 'string' as const,
                    description: 'Target node ID',
                  },
                  condition: {
                    type: 'string' as const,
                    description:
                      'Condition for this edge (null for unconditional, or a descriptive condition like "vitals_abnormal")',
                  },
                  label: {
                    type: 'string' as const,
                    description: 'Human-readable label for this edge (e.g., "If abnormal")',
                  },
                },
                required: ['id', 'from', 'to'],
              },
              minItems: 4,
            },
          },
          required: ['nodes', 'edges'],
        },
        reasoning: {
          type: 'string' as const,
          description:
            'Explain your reasoning for the SOP structure: why these nodes, why this branching, what regulatory considerations informed the design',
        },
      },
      required: ['title', 'description', 'graph', 'reasoning'],
    },
  };
}

function getNodeTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    [SOPNodeType.INFORMATION_GATHER]: 'collect data, vitals, documents',
    [SOPNodeType.ASSESSMENT]: 'evaluate and score information',
    [SOPNodeType.DECISION]: 'choose between paths based on criteria',
    [SOPNodeType.ACTION_DIGITAL]: 'digital action like sending a message or logging',
    [SOPNodeType.ACTION_PHYSICAL]: 'physical action requiring higher authorization',
    [SOPNodeType.CHECKPOINT]: 'human review required before proceeding',
    [SOPNodeType.ESCALATION]: 'hand off to human supervisor',
    [SOPNodeType.DOCUMENTATION]: 'generate a record or report',
    [SOPNodeType.HANDOVER]: 'transfer to another surrogate or human',
  };
  return descriptions[type] ?? type;
}

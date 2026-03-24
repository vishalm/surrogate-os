import type Anthropic from '@anthropic-ai/sdk';
import type { SOPGraph } from '@surrogate-os/shared';
import { SOPNodeType } from '@surrogate-os/shared';

interface SOPImprovementInput {
  currentGraph: SOPGraph;
  debriefData: {
    summary: string;
    recommendations: Record<string, unknown>[];
    edgeCases: Record<string, unknown>[];
    escalations: Record<string, unknown>[];
  };
  rationale?: string;
}

/**
 * System prompt for iterative SOP improvement.
 */
export function buildSOPImprovementSystemPrompt(): string {
  return `You are an expert at iteratively improving Standard Operating Procedures (SOPs) for AI surrogates. Your job is to take an existing SOP graph, debrief analysis from recent sessions, and produce an improved version of the SOP.

Key principles:
1. PRESERVE the overall structure when possible — only make changes that are justified by the debrief data.
2. ADD new decision branches for edge cases that were identified.
3. MODIFY escalation thresholds or conditions based on observed patterns.
4. ADD or refine checkpoint nodes where human review was needed but not present.
5. Keep node IDs stable when modifying existing nodes (do not rename IDs unless structurally necessary).
6. Ensure the resulting graph is a valid DAG with no orphan nodes.
7. Be conservative — prefer minimal targeted changes over wholesale restructuring.
8. Every change must be traceable to a specific debrief finding.`;
}

/**
 * User prompt with current graph and debrief data for SOP improvement.
 */
export function buildSOPImprovementPrompt(input: SOPImprovementInput): string {
  const graphJson = JSON.stringify(input.currentGraph, null, 2);
  const recommendationsText = input.debriefData.recommendations.length > 0
    ? JSON.stringify(input.debriefData.recommendations, null, 2)
    : 'No specific recommendations.';
  const edgeCasesText = input.debriefData.edgeCases.length > 0
    ? JSON.stringify(input.debriefData.edgeCases, null, 2)
    : 'No edge cases identified.';
  const escalationsText = input.debriefData.escalations.length > 0
    ? JSON.stringify(input.debriefData.escalations, null, 2)
    : 'No escalation issues identified.';

  const rationaleSection = input.rationale
    ? `\nAdditional Rationale from the operator:\n${input.rationale}\n`
    : '';

  return `Improve the following SOP based on the debrief analysis:

## Current SOP Graph
${graphJson}

## Debrief Summary
${input.debriefData.summary}

## Recommendations from Debrief
${recommendationsText}

## Edge Cases Identified
${edgeCasesText}

## Escalation Issues
${escalationsText}
${rationaleSection}
Requirements:
1. Produce an improved version of the SOP graph that addresses the debrief findings.
2. Keep existing node IDs stable where possible.
3. List every change you made and why.
4. The resulting graph must be structurally valid (all edges reference existing nodes).
5. Include at least one ESCALATION and one CHECKPOINT node.

Use the improve_sop tool to output the improved SOP.`;
}

/**
 * Anthropic Tool definition for structured SOP improvement output.
 */
export function buildSOPImprovementTool(): Anthropic.Tool {
  const nodeTypeValues = Object.values(SOPNodeType);

  return {
    name: 'improve_sop',
    description: 'Output an improved SOP graph with reasoning and change list.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string' as const,
          description: 'Updated title for the SOP (can remain the same if no title change needed).',
        },
        description: {
          type: 'string' as const,
          description: 'Updated description for the SOP.',
        },
        graph: {
          type: 'object' as const,
          properties: {
            nodes: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  id: { type: 'string' as const, description: 'Unique kebab-case node ID.' },
                  type: {
                    type: 'string' as const,
                    enum: nodeTypeValues,
                    description: `Node type. Options: ${nodeTypeValues.join(', ')}`,
                  },
                  label: { type: 'string' as const, description: 'Short display label.' },
                  description: { type: 'string' as const, description: 'Detailed node description.' },
                  config: { type: 'object' as const, description: 'Optional node configuration.' },
                },
                required: ['id', 'type', 'label', 'description'],
              },
              minItems: 1,
            },
            edges: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  id: { type: 'string' as const, description: 'Unique edge ID.' },
                  from: { type: 'string' as const, description: 'Source node ID.' },
                  to: { type: 'string' as const, description: 'Target node ID.' },
                  condition: { type: 'string' as const, description: 'Condition for traversal (null for unconditional).' },
                  label: { type: 'string' as const, description: 'Human-readable edge label.' },
                },
                required: ['id', 'from', 'to'],
              },
            },
          },
          required: ['nodes', 'edges'],
        },
        reasoning: {
          type: 'string' as const,
          description: 'Explain the overall reasoning for the changes made.',
        },
        changes: {
          type: 'array' as const,
          items: {
            type: 'string' as const,
          },
          description: 'A list of specific changes made, each as a short description (e.g., "Added edge-case branch for expired credentials").',
        },
      },
      required: ['title', 'description', 'graph', 'reasoning', 'changes'],
    },
  };
}

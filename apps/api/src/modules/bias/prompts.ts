import type Anthropic from '@anthropic-ai/sdk';

interface BiasAnalysisInput {
  surrogateId: string | null;
  surrogateInfo?: {
    roleTitle: string;
    domain: string;
  };
  decisions: {
    decision: string;
    outcome: string | null;
    confidence: number | null;
    context: Record<string, unknown>;
    surrogateId: string;
    createdAt: string;
  }[];
  debriefSummaries: {
    surrogateId: string;
    summary: string;
    generatedAt: string;
  }[];
}

/**
 * System prompt instructing LLM to analyze decision patterns for potential bias.
 */
export function buildBiasSystemPrompt(): string {
  return `You are an expert bias auditor for AI surrogate systems operating in professional domains. Your role is to:

1. Analyze decision patterns across surrogates for systematic biases — demographic, contextual, temporal, or procedural.
2. Identify statistical anomalies in decision outcomes, confidence distributions, and escalation rates.
3. Detect patterns that could indicate unfair treatment, inconsistent application of rules, or blind spots in decision-making.
4. Provide actionable recommendations to mitigate identified biases and improve fairness.
5. Distinguish between genuine bias signals and normal variance in decision-making.

Be rigorous and evidence-based. Reference specific patterns and statistics from the data. Avoid false positives — only flag genuine concerns with supporting evidence. Prioritize high-impact biases that could affect outcomes for stakeholders.`;
}

/**
 * User prompt with surrogate info, decision sample, and debrief summaries.
 */
export function buildBiasAnalysisPrompt(data: BiasAnalysisInput): string {
  const scope = data.surrogateId
    ? `Single Surrogate: ${data.surrogateId}`
    : 'Fleet-wide (all surrogates)';

  const surrogateInfo = data.surrogateInfo
    ? `\nRole: ${data.surrogateInfo.roleTitle}\nDomain: ${data.surrogateInfo.domain}`
    : '';

  const decisionsText = data.decisions.length > 0
    ? data.decisions.map((d, i) => {
        const parts = [
          `  Decision ${i + 1}: ${d.decision}`,
          d.outcome ? `  Outcome: ${d.outcome}` : null,
          d.confidence !== null ? `  Confidence: ${(d.confidence * 100).toFixed(0)}%` : null,
          Object.keys(d.context).length > 0 ? `  Context: ${JSON.stringify(d.context)}` : null,
          `  Surrogate: ${d.surrogateId}`,
          `  Timestamp: ${d.createdAt}`,
        ].filter(Boolean);
        return parts.join('\n');
      }).join('\n\n')
    : '  No decisions available.';

  const debriefText = data.debriefSummaries.length > 0
    ? data.debriefSummaries.map((d, i) =>
        `  Debrief ${i + 1} (Surrogate ${d.surrogateId}):\n  Summary: ${d.summary}\n  Generated: ${d.generatedAt}`
      ).join('\n\n')
    : '  No debriefs available.';

  return `Analyze the following decision data for potential bias patterns:

Scope: ${scope}${surrogateInfo}
Total Decisions Sampled: ${data.decisions.length}

Decision Sample:
${decisionsText}

Debrief Summaries:
${debriefText}

Perform a comprehensive bias analysis covering:
1. Overall assessment of bias risk in the decision patterns.
2. A bias score from 0 (no bias detected) to 1 (severe bias).
3. Specific anomalies detected — categorize each by type (e.g., "confidence_skew", "outcome_disparity", "escalation_gap", "temporal_pattern").
4. Actionable recommendations with priority levels and concrete action items.
5. Statistical summary of the decision data.

Use the analyze_bias tool to output your analysis.`;
}

/**
 * Anthropic Tool definition for structured bias analysis output.
 */
export function buildBiasAnalysisTool(): Anthropic.Tool {
  return {
    name: 'analyze_bias',
    description: 'Generate a structured bias analysis of surrogate decision patterns, including anomalies, recommendations, and statistical summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        overallAssessment: {
          type: 'string' as const,
          description: 'Comprehensive assessment of bias risk in the analyzed decision patterns. Include key findings, severity, and overall risk level.',
        },
        biasScore: {
          type: 'number' as const,
          description: 'Bias score from 0 to 1. 0 = no bias detected, 1 = severe bias. Based on statistical evidence from the decision sample.',
        },
        anomalies: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              category: {
                type: 'string' as const,
                description: 'Category of the anomaly (e.g., "confidence_skew", "outcome_disparity", "escalation_gap", "temporal_pattern", "procedural_bias").',
              },
              description: {
                type: 'string' as const,
                description: 'Detailed description of the anomaly detected.',
              },
              severity: {
                type: 'string' as const,
                enum: ['HIGH', 'MEDIUM', 'LOW'],
                description: 'Severity level of the anomaly.',
              },
              evidence: {
                type: 'string' as const,
                description: 'Specific evidence from the decision data supporting this anomaly.',
              },
            },
            required: ['category', 'description', 'severity', 'evidence'],
          },
          description: 'List of detected anomalies in decision patterns.',
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
              actionItems: {
                type: 'array' as const,
                items: { type: 'string' as const },
                description: 'Concrete action items to implement this recommendation.',
              },
            },
            required: ['title', 'description', 'priority', 'actionItems'],
          },
          description: 'Actionable recommendations to mitigate detected biases.',
        },
        statisticalSummary: {
          type: 'object' as const,
          properties: {
            decisionCount: {
              type: 'number' as const,
              description: 'Total number of decisions analyzed.',
            },
            avgConfidence: {
              type: 'number' as const,
              description: 'Average confidence score across all decisions (0-1).',
            },
            escalationRate: {
              type: 'number' as const,
              description: 'Rate of decisions that warranted or triggered escalation (0-1).',
            },
            outcomeDistribution: {
              type: 'object' as const,
              additionalProperties: { type: 'number' as const },
              description: 'Distribution of decision outcomes as key-value pairs (outcome label to count).',
            },
          },
          required: ['decisionCount', 'avgConfidence', 'escalationRate', 'outcomeDistribution'],
          description: 'Statistical summary of the decision data analyzed.',
        },
      },
      required: ['overallAssessment', 'biasScore', 'anomalies', 'recommendations', 'statisticalSummary'],
    },
  };
}

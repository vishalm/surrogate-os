import { createHash } from 'node:crypto';

/**
 * Generates a random sample from the Laplacian distribution.
 * Uses the inverse CDF method: L(mu, b) = mu - b * sign(u) * ln(1 - 2|u|)
 * where u ~ Uniform(-0.5, 0.5)
 */
function sampleLaplacian(scale: number): number {
  // Generate uniform random in (-0.5, 0.5), excluding 0
  let u = Math.random() - 0.5;
  while (u === 0) {
    u = Math.random() - 0.5;
  }
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

/**
 * Add Laplacian noise for differential privacy.
 *
 * @param value - The original numeric value
 * @param epsilon - Privacy parameter (smaller = more private, larger = more accurate)
 * @param sensitivity - Maximum change a single record can cause in the output
 * @returns The noised value
 */
export function addLaplacianNoise(
  value: number,
  epsilon: number,
  sensitivity: number,
): number {
  if (epsilon <= 0) {
    throw new Error('Epsilon must be positive');
  }
  if (sensitivity < 0) {
    throw new Error('Sensitivity must be non-negative');
  }

  const scale = sensitivity / epsilon;
  return value + sampleLaplacian(scale);
}

/**
 * Clip a gradient (or numeric array) to a maximum L2 norm.
 *
 * @param gradient - Array of numeric values representing a gradient vector
 * @param maxNorm - Maximum allowed L2 norm
 * @returns Clipped gradient
 */
export function clipGradient(gradient: number[], maxNorm: number): number[] {
  if (maxNorm <= 0) {
    throw new Error('maxNorm must be positive');
  }

  const l2Norm = Math.sqrt(gradient.reduce((sum, v) => sum + v * v, 0));

  if (l2Norm <= maxNorm) {
    return [...gradient];
  }

  const scale = maxNorm / l2Norm;
  return gradient.map((v) => v * scale);
}

/**
 * Strip PII from decision data, generalize timestamps, and add noise to confidence values.
 *
 * @param decisions - Array of decision records potentially containing PII
 * @returns Anonymized decision records safe for federation
 */
export function anonymizeDecisionData(
  decisions: Record<string, unknown>[],
): Record<string, unknown>[] {
  return decisions.map((decision) => {
    const anonymized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(decision)) {
      // Strip PII fields
      if (isPIIField(key)) {
        continue;
      }

      // Generalize timestamps to day granularity
      if (isTimestampField(key) && value) {
        const date = new Date(value as string);
        if (!isNaN(date.getTime())) {
          // Round to the start of the day (UTC)
          anonymized[key] = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
          ).toISOString();
          continue;
        }
      }

      // Add noise to confidence values
      if (isConfidenceField(key) && typeof value === 'number') {
        const noised = addLaplacianNoise(value, 1.0, 0.1);
        // Clamp to [0, 1]
        anonymized[key] = Math.max(0, Math.min(1, noised));
        continue;
      }

      // Hash any ID fields that slip through
      if (key.toLowerCase().endsWith('id') && typeof value === 'string') {
        anonymized[key] = hashValue(value);
        continue;
      }

      anonymized[key] = value;
    }

    return anonymized;
  });
}

/**
 * Track cumulative privacy budget usage (basic composition theorem).
 *
 * @param queries - Number of queries that have been executed
 * @param epsilon - Epsilon used per query
 * @returns Total privacy budget consumed
 */
export function computePrivacyBudget(queries: number, epsilon: number): number {
  // Basic sequential composition: total budget = queries * epsilon
  return queries * epsilon;
}

/**
 * Compute safe aggregate statistics from anonymized decision data.
 *
 * @param anonymizedData - Array of anonymized decision records
 * @returns Aggregate insights with noise applied
 */
export function generateAggregateInsights(
  anonymizedData: Record<string, unknown>[],
): Record<string, unknown> {
  if (anonymizedData.length === 0) {
    return {
      totalRecords: 0,
      avgConfidence: null,
      decisionDistribution: {},
      escalationRate: 0,
      commonPatterns: [],
    };
  }

  const epsilon = 1.0;
  const totalRecords = anonymizedData.length;

  // Aggregate confidence values with noise
  const confidences = anonymizedData
    .map((d) => d.confidence as number | undefined)
    .filter((c): c is number => typeof c === 'number');

  const rawAvgConfidence =
    confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : null;

  const avgConfidence =
    rawAvgConfidence !== null
      ? Math.max(0, Math.min(1, addLaplacianNoise(rawAvgConfidence, epsilon, 1.0 / totalRecords)))
      : null;

  // Decision distribution (count by decision type)
  const decisionCounts: Record<string, number> = {};
  for (const record of anonymizedData) {
    const decision = record.decision as string | undefined;
    if (decision) {
      decisionCounts[decision] = (decisionCounts[decision] ?? 0) + 1;
    }
  }

  // Add noise to each count
  const noisedDistribution: Record<string, number> = {};
  for (const [key, count] of Object.entries(decisionCounts)) {
    const noisedCount = Math.max(0, Math.round(addLaplacianNoise(count, epsilon, 1)));
    noisedDistribution[key] = noisedCount;
  }

  // Escalation rate with noise
  const escalationCount = anonymizedData.filter(
    (d) => d.escalated === true || d.action === 'ESCALATION',
  ).length;
  const rawEscalationRate = escalationCount / totalRecords;
  const escalationRate = Math.max(
    0,
    Math.min(1, addLaplacianNoise(rawEscalationRate, epsilon, 1.0 / totalRecords)),
  );

  // Common patterns (top decision types)
  const sortedDecisions = Object.entries(noisedDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([decision, count]) => ({ decision, count }));

  return {
    totalRecords: Math.max(0, Math.round(addLaplacianNoise(totalRecords, epsilon, 1))),
    avgConfidence,
    decisionDistribution: noisedDistribution,
    escalationRate: Math.round(escalationRate * 1000) / 1000,
    commonPatterns: sortedDecisions,
  };
}

// --- Internal helpers ---

const PII_FIELDS = new Set([
  'email',
  'name',
  'username',
  'phone',
  'address',
  'ssn',
  'ip',
  'ip_address',
  'ipaddress',
  'user_email',
  'user_name',
  'full_name',
  'first_name',
  'last_name',
  'password',
  'password_hash',
  'refresh_token',
  'token',
]);

function isPIIField(key: string): boolean {
  return PII_FIELDS.has(key.toLowerCase());
}

function isTimestampField(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.endsWith('_at') ||
    lower.endsWith('at') ||
    lower === 'timestamp' ||
    lower === 'date' ||
    lower === 'created' ||
    lower === 'updated'
  );
}

function isConfidenceField(key: string): boolean {
  const lower = key.toLowerCase();
  return lower === 'confidence' || lower === 'score' || lower === 'probability';
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

import { z } from 'zod';
import {
  OrgPlan,
  UserRole,
  SurrogateStatus,
  SOPStatus,
  SOPNodeType,
  AuditAction,
  HandoffType,
} from '../constants';

// --- Org Schemas ---

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      'Slug must be lowercase alphanumeric with hyphens, cannot start or end with a hyphen',
    ),
  plan: z.nativeEnum(OrgPlan).optional().default(OrgPlan.STUDIO),
});

export const updateOrgSchema = createOrgSchema.partial();

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

// --- User Schemas ---

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(UserRole).optional().default(UserRole.MEMBER),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// --- Surrogate Config Schema ---

const surrogateConfigSchema = z.object({
  seniority: z.string().min(1),
  certifications: z.array(z.string()),
  communicationStyle: z.string().min(1),
  assertiveness: z.number().int().min(1).max(10),
  empathyLevel: z.number().int().min(1).max(10),
  riskTolerance: z.enum(['low', 'medium', 'high']),
  escalationThreshold: z.number().min(0).max(1),
});

// --- Surrogate Schemas ---

export const createSurrogateSchema = z.object({
  roleTitle: z.string().min(1).max(200),
  domain: z.string().min(1).max(200),
  jurisdiction: z.string().min(1).max(200),
  config: surrogateConfigSchema.partial().optional(),
});

export const updateSurrogateSchema = z.object({
  roleTitle: z.string().min(1).max(200).optional(),
  domain: z.string().min(1).max(200).optional(),
  jurisdiction: z.string().min(1).max(200).optional(),
  status: z.nativeEnum(SurrogateStatus).optional(),
  config: surrogateConfigSchema.partial().optional(),
});

export type CreateSurrogateInput = z.infer<typeof createSurrogateSchema>;
export type UpdateSurrogateInput = z.infer<typeof updateSurrogateSchema>;

// --- SOP Schemas ---

const sopNodeSchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(SOPNodeType),
  label: z.string().min(1),
  description: z.string(),
  config: z.record(z.unknown()).default({}),
});

const sopEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  condition: z.string().nullable().default(null),
  label: z.string().nullable().default(null),
});

export const sopGraphSchema = z.object({
  nodes: z.array(sopNodeSchema).min(1),
  edges: z.array(sopEdgeSchema),
});

export const createSOPSchema = z.object({
  surrogateId: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string(),
  graph: sopGraphSchema,
});

export type CreateSOPInput = z.infer<typeof createSOPSchema>;

// --- Audit Entry Schema ---

export const createAuditEntrySchema = z.object({
  surrogateId: z.string().optional(),
  action: z.nativeEnum(AuditAction),
  details: z.record(z.unknown()).default({}),
  rationale: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  humanAuthRequired: z.boolean(),
});

export type CreateAuditEntryInput = z.infer<typeof createAuditEntrySchema>;

// --- Pagination Schema ---

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// --- Session Schemas ---

export const createSessionSchema = z.object({
  surrogateId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

export const completeSessionSchema = z.object({
  outcome: z.string().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;

// --- Decision Outcome Schemas ---

export const createDecisionOutcomeSchema = z.object({
  sessionId: z.string().uuid(),
  surrogateId: z.string().uuid(),
  sopNodeId: z.string().optional(),
  decision: z.string().min(1),
  outcome: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  context: z.record(z.unknown()).optional(),
});

export type CreateDecisionOutcomeInput = z.infer<typeof createDecisionOutcomeSchema>;

// --- Debrief Schemas ---

export const generateDebriefSchema = z.object({
  sessionId: z.string().uuid(),
});

export type GenerateDebriefInput = z.infer<typeof generateDebriefSchema>;

// --- SOP Proposal Schemas ---

export const createSOPProposalSchema = z.object({
  sopId: z.string().uuid(),
  debriefId: z.string().uuid().optional(),
  proposedGraph: sopGraphSchema.optional(),
  rationale: z.string().min(1).optional(),
});

export const reviewSOPProposalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().optional(),
});

export type CreateSOPProposalInput = z.infer<typeof createSOPProposalSchema>;
export type ReviewSOPProposalInput = z.infer<typeof reviewSOPProposalSchema>;

// --- Document Schemas ---

export const uploadDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  mimeType: z.string().default('text/plain'),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

// --- Memory Schemas ---

export const createMemoryEntrySchema = z.object({
  surrogateId: z.string().uuid(),
  type: z.enum(['STM', 'LTM']).default('STM'),
  source: z.enum(['DEBRIEF', 'PATTERN_DETECTION', 'MANUAL', 'SOP_EXECUTION']).default('MANUAL'),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
});

export type CreateMemoryEntryInput = z.infer<typeof createMemoryEntrySchema>;

// --- Phase 3: Handoff Schemas ---

export const createHandoffSchema = z.object({
  surrogateId: z.string().uuid(),
  targetSurrogateId: z.string().uuid().optional(),
  targetHumanId: z.string().uuid().optional(),
  type: z.enum([HandoffType.DIGITAL_TO_DIGITAL, HandoffType.DIGITAL_TO_HUMAN, HandoffType.HUMAN_TO_DIGITAL]),
  sessionId: z.string().uuid().optional(),
  context: z.record(z.unknown()).optional(),
});

export const acceptHandoffSchema = z.object({});

export type CreateHandoffInput = z.infer<typeof createHandoffSchema>;
export type AcceptHandoffInput = z.infer<typeof acceptHandoffSchema>;

// --- Phase 3: Persona Template Schemas ---

export const createPersonaTemplateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  domain: z.string(),
  jurisdiction: z.string(),
  baseConfig: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export const updatePersonaTemplateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  domain: z.string().optional(),
  jurisdiction: z.string().optional(),
  baseConfig: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export type CreatePersonaTemplateInput = z.infer<typeof createPersonaTemplateSchema>;
export type UpdatePersonaTemplateInput = z.infer<typeof updatePersonaTemplateSchema>;

// --- Phase 3: Marketplace Schemas ---

export const publishMarketplaceListingSchema = z.object({
  sopId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  domain: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  price: z.number().min(0).default(0),
});

export const installMarketplaceListingSchema = z.object({});

export const createMarketplaceReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export type PublishMarketplaceListingInput = z.infer<typeof publishMarketplaceListingSchema>;
export type InstallMarketplaceListingInput = z.infer<typeof installMarketplaceListingSchema>;
export type CreateMarketplaceReviewInput = z.infer<typeof createMarketplaceReviewSchema>;

// --- Phase 3: Bias Check Schemas ---

export const triggerBiasCheckSchema = z.object({
  surrogateId: z.string().uuid().optional(),
});

export type TriggerBiasCheckInput = z.infer<typeof triggerBiasCheckSchema>;

// --- Phase 4D: Execution Schemas ---

export const startExecutionSchema = z.object({
  surrogateId: z.string().uuid(),
  sopId: z.string().uuid(),
});

export const advanceExecutionSchema = z.object({
  decision: z.string().min(1),
  edgeId: z.string().min(1),
  input: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional().default(1.0),
});

export const abortExecutionSchema = z.object({
  reason: z.string().min(1),
});

export const escalateExecutionSchema = z.object({
  reason: z.string().min(1),
});

export type StartExecutionInput = z.infer<typeof startExecutionSchema>;
export type AdvanceExecutionInput = z.infer<typeof advanceExecutionSchema>;
export type AbortExecutionInput = z.infer<typeof abortExecutionSchema>;
export type EscalateExecutionInput = z.infer<typeof escalateExecutionSchema>;

// --- Phase 3: Fleet Filter Schema ---

export const fleetFilterSchema = z.object({
  domain: z.string().optional(),
  status: z.string().optional(),
  jurisdiction: z.string().optional(),
});

export type FleetFilterInput = z.infer<typeof fleetFilterSchema>;

// --- Phase 4B: Federation Schemas ---

export const createFederationContributionSchema = z.object({
  domain: z.string().min(1),
  category: z.string().optional(),
  decisionData: z.array(z.record(z.unknown())).min(1),
  epsilon: z.number().min(0.01).max(10).default(1.0),
});

export const federationInsightsQuerySchema = z.object({
  domain: z.string().optional(),
  category: z.string().optional(),
});

export const applyFederationInsightsSchema = z.object({
  insights: z.array(z.record(z.unknown())).min(1),
  rationale: z.string().optional(),
});

export const updateFederationParticipationSchema = z.object({
  optedIn: z.boolean(),
  domains: z.array(z.string()).optional(),
});

export type CreateFederationContributionInput = z.infer<typeof createFederationContributionSchema>;
export type FederationInsightsQueryInput = z.infer<typeof federationInsightsQuerySchema>;
export type ApplyFederationInsightsInput = z.infer<typeof applyFederationInsightsSchema>;
export type UpdateFederationParticipationInput = z.infer<typeof updateFederationParticipationSchema>;

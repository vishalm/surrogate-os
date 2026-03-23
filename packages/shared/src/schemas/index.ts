import { z } from 'zod';
import {
  OrgPlan,
  UserRole,
  SurrogateStatus,
  SOPStatus,
  SOPNodeType,
  AuditAction,
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

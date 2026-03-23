import {
  OrgPlan,
  UserRole,
  SurrogateStatus,
  SOPStatus,
  SOPNodeType,
  AuditAction,
} from '../constants';

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurrogateConfig {
  seniority: string;
  certifications: string[];
  communicationStyle: string;
  assertiveness: number; // 1-10
  empathyLevel: number; // 1-10
  riskTolerance: 'low' | 'medium' | 'high';
  escalationThreshold: number; // 0-1
}

export interface Surrogate {
  id: string;
  orgId: string;
  roleTitle: string;
  domain: string;
  jurisdiction: string;
  status: SurrogateStatus;
  config: SurrogateConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface SOPNode {
  id: string;
  type: SOPNodeType;
  label: string;
  description: string;
  config: Record<string, unknown>;
}

export interface SOPEdge {
  id: string;
  from: string;
  to: string;
  condition: string | null;
  label: string | null;
}

export interface SOPGraph {
  nodes: SOPNode[];
  edges: SOPEdge[];
}

export interface SOP {
  id: string;
  surrogateId: string;
  version: number;
  status: SOPStatus;
  title: string;
  description: string;
  graph: SOPGraph;
  certifiedBy: string | null;
  hash: string;
  previousVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEntry {
  id: string;
  surrogateId: string | null;
  orgId: string;
  userId: string | null;
  action: AuditAction;
  details: Record<string, unknown>;
  rationale: string | null;
  confidence: number | null; // 0-1
  humanAuthRequired: boolean;
  humanAuthGrantedBy: string | null;
  previousHash: string | null;
  hash: string;
  createdAt: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
}

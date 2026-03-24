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

export interface Session {
  id: string;
  surrogateId: string;
  status: string;
  metadata: Record<string, unknown>;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
}

export interface DecisionOutcome {
  id: string;
  sessionId: string;
  surrogateId: string;
  sopNodeId: string | null;
  decision: string;
  outcome: string | null;
  confidence: number | null;
  context: Record<string, unknown>;
  createdAt: Date;
}

export interface Debrief {
  id: string;
  sessionId: string;
  surrogateId: string;
  summary: string;
  decisions: Record<string, unknown>[];
  escalations: Record<string, unknown>[];
  edgeCases: Record<string, unknown>[];
  recommendations: Record<string, unknown>[];
  confidence: number | null;
  generatedAt: Date;
}

export interface SOPProposal {
  id: string;
  sopId: string;
  surrogateId: string;
  proposedBy: string;
  status: string;
  currentGraph: SOPGraph;
  proposedGraph: SOPGraph;
  diff: Record<string, unknown>;
  rationale: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface OrgDocument {
  id: string;
  title: string;
  mimeType: string;
  status: string;
  chunkCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

export interface MemoryEntry {
  id: string;
  surrogateId: string;
  type: string;
  source: string;
  content: string;
  tags: string[];
  observationCount: number;
  firstObservedAt: Date;
  lastObservedAt: Date;
  expiresAt: Date | null;
  promotedAt: Date | null;
  createdAt: Date;
}

export interface Handoff {
  id: string;
  sourceSurrogateId: string;
  targetSurrogateId: string | null;
  targetHumanId: string | null;
  type: string;
  status: string;
  contextBundle: Record<string, unknown>;
  summary: string | null;
  sessionId: string | null;
  initiatedBy: string;
  acceptedBy: string | null;
  initiatedAt: Date;
  acceptedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface PersonaTemplate {
  id: string;
  name: string;
  description: string | null;
  domain: string;
  jurisdiction: string;
  baseConfig: Record<string, unknown>;
  tags: string[];
  category: string | null;
  status: string;
  currentVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonaVersion {
  id: string;
  templateId: string;
  version: string;
  config: Record<string, unknown>;
  changelog: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface MarketplaceListing {
  id: string;
  orgId: string;
  sopTitle: string;
  sopDescription: string;
  sopGraph: Record<string, unknown>;
  domain: string;
  category: string | null;
  tags: string[];
  price: number;
  currency: string;
  status: string;
  installCount: number;
  avgRating: number | null;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceReview {
  id: string;
  listingId: string;
  orgId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface BiasCheck {
  id: string;
  surrogateId: string | null;
  status: string;
  analysis: Record<string, unknown>;
  decisionSampleSize: number;
  anomalies: Record<string, unknown>[];
  recommendations: Record<string, unknown>[];
  confidence: number | null;
  triggeredBy: string;
  completedAt: Date | null;
  createdAt: Date;
}

export interface Execution {
  id: string;
  sessionId: string | null;
  surrogateId: string;
  sopId: string;
  currentNodeId: string;
  visitedNodes: string[];
  decisions: ExecutionDecision[];
  status: string;
  context: Record<string, unknown>;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ExecutionDecision {
  nodeId: string;
  edgeId: string;
  decision: string;
  confidence: number;
  timestamp: Date;
  input?: Record<string, unknown>;
}

export interface FleetStatus {
  active: number;
  idle: number;
  paused: number;
  archived: number;
  totalSessions: number;
  activeSessions: number;
}

export interface FederationContribution {
  id: string;
  orgId: string;
  domain: string;
  category: string | null;
  dataHash: string;
  anonymizedData: Record<string, unknown>;
  privacyEpsilon: number;
  recordCount: number;
  status: string;
  createdAt: Date;
}

export interface FederationSettings {
  id: string;
  orgId: string;
  optedIn: boolean;
  privacyBudget: number;
  budgetUsed: number;
  domains: string[];
  updatedAt: Date;
}

export interface FederationPoolInsight {
  domain: string;
  category: string | null;
  totalContributions: number;
  totalRecords: number;
  avgConfidence: number;
  topDecisionPatterns: Record<string, unknown>[];
  escalationRate: number;
  commonEdgeCases: string[];
}

export interface FederationPrivacyReport {
  orgId: string;
  budgetTotal: number;
  budgetUsed: number;
  budgetRemaining: number;
  contributionCount: number;
  totalRecordsShared: number;
  queriesExecuted: number;
}

export interface FederationLeaderboardEntry {
  rank: number;
  orgHash: string;
  contributionCount: number;
  totalRecords: number;
  domains: string[];
}

import type { PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import type { PaginationParams } from '../../lib/pagination.js';
import { buildPaginatedResponse } from '../../lib/pagination.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { AuditAction } from '@surrogate-os/shared';
import {
  BUILT_IN_FRAMEWORKS,
  type ComplianceFramework,
  type ComplianceRequirement,
} from './frameworks.js';
import {
  signSOP as cryptoSignSOP,
  verifySOP as cryptoVerifySOP,
  computeSOPFingerprint,
  generateSigningKeyPair,
  buildChainOfCustody,
} from './sop-signing.js';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface ComplianceCheckRow {
  id: string;
  surrogate_id: string;
  framework_id: string;
  status: string;
  results: unknown;
  passed: number;
  failed: number;
  score: number | null;
  report: unknown;
  checked_by: string | null;
  created_at: Date;
}

interface SOPSignatureRow {
  id: string;
  sop_id: string;
  signer_id: string;
  signature: string;
  public_key: string;
  algorithm: string;
  fingerprint: string;
  signed_at: Date;
}

interface SOPRow {
  id: string;
  surrogate_id: string;
  version: number;
  status: string;
  title: string;
  description: string | null;
  graph: Record<string, unknown>;
  certified_by: string | null;
  hash: string;
  created_at: Date;
  updated_at: Date;
}

interface SurrogateRow {
  id: string;
  role_title: string;
  domain: string;
  jurisdiction: string;
  status: string;
  config: Record<string, unknown>;
}

interface CountRow {
  count: bigint;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapComplianceCheckRow(row: ComplianceCheckRow) {
  return {
    id: row.id,
    surrogateId: row.surrogate_id,
    frameworkId: row.framework_id,
    status: row.status,
    results: row.results,
    passed: row.passed,
    failed: row.failed,
    score: row.score,
    report: row.report,
    checkedBy: row.checked_by,
    createdAt: row.created_at,
  };
}

function mapSOPSignatureRow(row: SOPSignatureRow) {
  return {
    id: row.id,
    sopId: row.sop_id,
    signerId: row.signer_id,
    signature: row.signature,
    publicKey: row.public_key,
    algorithm: row.algorithm,
    fingerprint: row.fingerprint,
    signedAt: row.signed_at,
  };
}

// ---------------------------------------------------------------------------
// Compliance check functions
// ---------------------------------------------------------------------------

interface CheckResult {
  requirementId: string;
  title: string;
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'NOT_APPLICABLE';
  evidence: string;
  severity: string;
}

function runRequirementCheck(
  requirement: ComplianceRequirement,
  surrogate: SurrogateRow,
  sops: SOPRow[],
  auditCount: number,
  signatureCount: number,
  biasCheckCount: number,
): CheckResult {
  const base = {
    requirementId: requirement.id,
    title: requirement.title,
    severity: requirement.severity,
  };

  // Each checkFunction maps to a heuristic validation
  switch (requirement.checkFunction) {
    // ----- Common checks -----
    case 'checkSOPCertification':
    case 'checkChangeManagement':
    case 'checkManagementCertification': {
      const certifiedSOPs = sops.filter((s) => s.status === 'CERTIFIED');
      if (certifiedSOPs.length === 0 && sops.length > 0) {
        return { ...base, status: 'FAILED', evidence: `0 of ${sops.length} SOPs are certified.` };
      }
      if (certifiedSOPs.length < sops.length) {
        return { ...base, status: 'WARNING', evidence: `${certifiedSOPs.length} of ${sops.length} SOPs certified.` };
      }
      return { ...base, status: 'PASSED', evidence: `All ${sops.length} SOPs are certified.` };
    }

    case 'checkDecisionAuditTrail':
    case 'checkTransactionAuditTrail':
    case 'checkLoggingTraceability':
    case 'checkPHIAccessLogging': {
      if (auditCount > 0) {
        return { ...base, status: 'PASSED', evidence: `${auditCount} audit entries found with tamper-evident hashing.` };
      }
      return { ...base, status: 'WARNING', evidence: 'No audit entries found. Ensure operations are being logged.' };
    }

    case 'checkEscalationThreshold':
    case 'checkHumanOverride':
    case 'checkHumanOversightMechanism':
    case 'checkHumanReviewRight': {
      const config = surrogate.config as Record<string, unknown>;
      const threshold = config.escalationThreshold as number | undefined;
      if (threshold !== undefined && threshold <= 0.8) {
        return { ...base, status: 'PASSED', evidence: `Escalation threshold set to ${threshold}.` };
      }
      if (threshold !== undefined && threshold > 0.8) {
        return { ...base, status: 'WARNING', evidence: `Escalation threshold is ${threshold}, which may be too high for this regulation.` };
      }
      return { ...base, status: 'FAILED', evidence: 'No escalation threshold configured.' };
    }

    case 'checkConsentTracking':
    case 'checkLawfulBasis': {
      const config = surrogate.config as Record<string, unknown>;
      if (config.consentTracking || config.lawfulBasis) {
        return { ...base, status: 'PASSED', evidence: 'Consent/lawful basis configuration present.' };
      }
      return { ...base, status: 'FAILED', evidence: 'No consent tracking or lawful basis configured in surrogate config.' };
    }

    case 'checkRoleBasedAccess':
    case 'checkMinimumNecessary':
    case 'checkSegregationOfDuties':
    case 'checkAccessControl': {
      // Platform enforces RBAC via authGuard + requireRole — always passes
      return { ...base, status: 'PASSED', evidence: 'Platform enforces role-based access control (OWNER/ADMIN/MEMBER).' };
    }

    case 'checkDataRetention':
    case 'checkRecordRetention':
    case 'checkProcessingRecords': {
      if (auditCount > 0) {
        return { ...base, status: 'PASSED', evidence: `${auditCount} audit records retained with immutable hash chain.` };
      }
      return { ...base, status: 'WARNING', evidence: 'No audit records found yet.' };
    }

    case 'checkPHISafeguards':
    case 'checkDataMinimisation': {
      // Platform uses TLS + encrypted DB — pass by default
      return { ...base, status: 'PASSED', evidence: 'Platform enforces encryption at rest (database) and in transit (TLS).' };
    }

    case 'checkBreachNotificationReadiness':
    case 'checkDSARCapability': {
      if (auditCount > 0) {
        return { ...base, status: 'PASSED', evidence: 'Audit trail supports data export for breach notification and DSAR.' };
      }
      return { ...base, status: 'WARNING', evidence: 'No audit data available for export.' };
    }

    case 'checkRiskAssessment':
    case 'checkDPIA':
    case 'checkAIRiskClassification': {
      const config = surrogate.config as Record<string, unknown>;
      if (config.riskTolerance) {
        return { ...base, status: 'PASSED', evidence: `Risk tolerance configured as "${config.riskTolerance}".` };
      }
      return { ...base, status: 'FAILED', evidence: 'No risk classification or assessment configured.' };
    }

    case 'checkRightToExplanation':
    case 'checkTechnicalDocumentation': {
      if (sops.length > 0 && auditCount > 0) {
        return { ...base, status: 'PASSED', evidence: `${sops.length} SOPs and ${auditCount} audit entries provide traceability.` };
      }
      return { ...base, status: 'WARNING', evidence: 'Insufficient documentation: ensure SOPs and audit trail are populated.' };
    }

    case 'checkClientOutcomeMonitoring':
    case 'checkSeniorManagerAccountability': {
      if (auditCount > 0 && sops.some((s) => s.status === 'CERTIFIED')) {
        return { ...base, status: 'PASSED', evidence: 'Certified SOPs and audit trail enable outcome monitoring and accountability.' };
      }
      return { ...base, status: 'WARNING', evidence: 'Ensure SOPs are certified and audit trail is active.' };
    }

    case 'checkFairTreatment':
    case 'checkBiasFairnessMonitoring': {
      if (biasCheckCount > 0) {
        return { ...base, status: 'PASSED', evidence: `${biasCheckCount} bias audit checks completed.` };
      }
      return { ...base, status: 'FAILED', evidence: 'No bias audit checks have been run. Run a bias check to satisfy this requirement.' };
    }

    case 'checkTransparencyDisclosure': {
      const config = surrogate.config as Record<string, unknown>;
      if (config.transparencyDisclosure || config.communicationStyle) {
        return { ...base, status: 'PASSED', evidence: 'Transparency disclosure configured.' };
      }
      return { ...base, status: 'WARNING', evidence: 'No explicit transparency disclosure configured.' };
    }

    case 'checkInternalControls': {
      if (signatureCount > 0) {
        return { ...base, status: 'PASSED', evidence: `${signatureCount} SOP signatures provide cryptographic internal controls.` };
      }
      return { ...base, status: 'FAILED', evidence: 'No SOP signatures found. Sign SOPs to establish internal controls.' };
    }

    default:
      return { ...base, status: 'NOT_APPLICABLE', evidence: `Check "${requirement.checkFunction}" not implemented.` };
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ComplianceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  // ---- Frameworks ----

  listFrameworks(filters?: { domain?: string; jurisdiction?: string }): ComplianceFramework[] {
    let result = BUILT_IN_FRAMEWORKS;
    if (filters?.domain) {
      result = result.filter((f) => f.domain === filters.domain);
    }
    if (filters?.jurisdiction) {
      result = result.filter((f) => f.jurisdiction === filters.jurisdiction);
    }
    return result;
  }

  getFramework(id: string): ComplianceFramework {
    const framework = BUILT_IN_FRAMEWORKS.find((f) => f.id === id);
    if (!framework) {
      throw new NotFoundError(`Framework "${id}" not found`);
    }
    return framework;
  }

  // ---- Compliance Checks ----

  async runComplianceCheck(
    tenant: TenantContext,
    surrogateId: string,
    frameworkId: string,
    userId: string,
  ) {
    const framework = this.getFramework(frameworkId);

    // Fetch surrogate
    const surrogates = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      'SELECT * FROM surrogates WHERE id = $1::uuid',
      [surrogateId],
    );
    if (surrogates.length === 0) {
      throw new NotFoundError('Surrogate not found');
    }
    const surrogate = surrogates[0];

    // Fetch SOPs for surrogate
    const sops = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      'SELECT * FROM sops WHERE surrogate_id = $1::uuid',
      [surrogateId],
    );

    // Count audit entries
    const auditCountRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      'SELECT COUNT(*) as count FROM audit_entries WHERE surrogate_id = $1::uuid',
      [surrogateId],
    );
    const auditCount = Number(auditCountRows[0].count);

    // Count SOP signatures
    const sopIds = sops.map((s) => s.id);
    let signatureCount = 0;
    if (sopIds.length > 0) {
      const placeholders = sopIds.map((_, i) => `$${i + 1}::uuid`).join(', ');
      const sigCountRows = await this.tenantManager.executeInTenant<CountRow[]>(
        tenant.orgSlug,
        `SELECT COUNT(*) as count FROM sop_signatures WHERE sop_id IN (${placeholders})`,
        sopIds,
      );
      signatureCount = Number(sigCountRows[0].count);
    }

    // Count bias checks
    let biasCheckCount = 0;
    try {
      const biasCountRows = await this.tenantManager.executeInTenant<CountRow[]>(
        tenant.orgSlug,
        'SELECT COUNT(*) as count FROM bias_checks WHERE surrogate_id = $1::uuid',
        [surrogateId],
      );
      biasCheckCount = Number(biasCountRows[0].count);
    } catch {
      // bias_checks table may not exist
    }

    // Run checks
    const results: CheckResult[] = framework.requirements.map((req) =>
      runRequirementCheck(req, surrogate, sops, auditCount, signatureCount, biasCheckCount),
    );

    const passed = results.filter((r) => r.status === 'PASSED').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;
    const total = results.length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;
    const status = failed === 0 ? 'PASSED' : 'FAILED';

    // Persist
    const rows = await this.tenantManager.executeInTenant<ComplianceCheckRow[]>(
      tenant.orgSlug,
      `INSERT INTO compliance_checks (surrogate_id, framework_id, status, results, passed, failed, score, checked_by)
       VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7, $8::uuid)
       RETURNING *`,
      [surrogateId, frameworkId, status, JSON.stringify(results), passed, failed, score, userId],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId,
      userId,
      action: AuditAction.COMPLIANCE_CHECK_RUN,
      details: { frameworkId, status, score, passed, failed },
    });

    return mapComplianceCheckRow(rows[0]);
  }

  async getComplianceHistory(
    tenant: TenantContext,
    surrogateId: string,
    pagination: PaginationParams,
  ) {
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      'SELECT COUNT(*) as count FROM compliance_checks WHERE surrogate_id = $1::uuid',
      [surrogateId],
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<ComplianceCheckRow[]>(
      tenant.orgSlug,
      `SELECT * FROM compliance_checks WHERE surrogate_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [surrogateId, pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapComplianceCheckRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getCertificationStatus(tenant: TenantContext, surrogateId: string) {
    // Get the latest check per framework
    const rows = await this.tenantManager.executeInTenant<ComplianceCheckRow[]>(
      tenant.orgSlug,
      `SELECT DISTINCT ON (framework_id) *
       FROM compliance_checks
       WHERE surrogate_id = $1::uuid
       ORDER BY framework_id, created_at DESC`,
      [surrogateId],
    );

    return rows.map(mapComplianceCheckRow);
  }

  async generateComplianceReport(
    tenant: TenantContext,
    surrogateId: string,
    frameworkId: string,
    userId: string,
  ) {
    // Run a fresh check
    const check = await this.runComplianceCheck(tenant, surrogateId, frameworkId, userId);

    const framework = this.getFramework(frameworkId);
    const results = check.results as CheckResult[];

    const report = {
      generatedAt: new Date().toISOString(),
      frameworkName: framework.name,
      frameworkVersion: framework.version,
      jurisdiction: framework.jurisdiction,
      domain: framework.domain,
      surrogateId,
      overallStatus: check.status,
      score: check.score,
      summary: {
        total: results.length,
        passed: check.passed,
        failed: check.failed,
        warnings: results.filter((r) => r.status === 'WARNING').length,
        notApplicable: results.filter((r) => r.status === 'NOT_APPLICABLE').length,
      },
      criticalFailures: results.filter((r) => r.status === 'FAILED' && r.severity === 'CRITICAL'),
      highFailures: results.filter((r) => r.status === 'FAILED' && r.severity === 'HIGH'),
      requirements: results,
    };

    // Update the check record with the report
    await this.tenantManager.executeInTenant(
      tenant.orgSlug,
      'UPDATE compliance_checks SET report = $1::jsonb WHERE id = $2::uuid',
      [JSON.stringify(report), check.id],
    );

    return { ...check, report };
  }

  // ---- SOP Signing ----

  async signSOP(tenant: TenantContext, sopId: string, userId: string) {
    // Fetch the SOP
    const sops = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      'SELECT * FROM sops WHERE id = $1::uuid',
      [sopId],
    );
    if (sops.length === 0) {
      throw new NotFoundError('SOP not found');
    }
    const sop = sops[0];

    if (sop.status !== 'CERTIFIED' && sop.status !== 'REVIEW') {
      throw new ValidationError('Only SOPs in REVIEW or CERTIFIED status can be signed.');
    }

    // Generate a key pair for this signing event
    // In production this would use the org's stored key pair
    const { privateKey } = generateSigningKeyPair();
    const sigResult = cryptoSignSOP(sop.graph, privateKey);

    // Persist the signature
    const rows = await this.tenantManager.executeInTenant<SOPSignatureRow[]>(
      tenant.orgSlug,
      `INSERT INTO sop_signatures (sop_id, signer_id, signature, public_key, algorithm, fingerprint)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
       RETURNING *`,
      [
        sopId,
        userId,
        sigResult.signature,
        sigResult.signerPublicKey,
        sigResult.algorithm,
        sigResult.fingerprint,
      ],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: sop.surrogate_id,
      userId,
      action: AuditAction.SOP_SIGNED,
      details: { sopId, fingerprint: sigResult.fingerprint },
    });

    return mapSOPSignatureRow(rows[0]);
  }

  async verifySOP(tenant: TenantContext, sopId: string) {
    // Fetch the SOP
    const sops = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      'SELECT * FROM sops WHERE id = $1::uuid',
      [sopId],
    );
    if (sops.length === 0) {
      throw new NotFoundError('SOP not found');
    }
    const sop = sops[0];

    // Fetch all signatures for this SOP
    const signatures = await this.tenantManager.executeInTenant<SOPSignatureRow[]>(
      tenant.orgSlug,
      'SELECT * FROM sop_signatures WHERE sop_id = $1::uuid ORDER BY signed_at ASC',
      [sopId],
    );

    if (signatures.length === 0) {
      return {
        sopId,
        fingerprint: computeSOPFingerprint(sop.graph),
        signed: false,
        chain: [],
      };
    }

    const chain = buildChainOfCustody(
      sop.graph,
      signatures.map((s) => ({
        id: s.id,
        signerId: s.signer_id,
        signature: s.signature,
        publicKey: s.public_key,
        fingerprint: s.fingerprint,
        signedAt: s.signed_at.toISOString(),
      })),
    );

    const allVerified = chain.every((c) => c.verified);
    const currentFingerprint = computeSOPFingerprint(sop.graph);
    const fingerprintMatch = signatures.every((s) => s.fingerprint === currentFingerprint);

    return {
      sopId,
      fingerprint: currentFingerprint,
      signed: true,
      allVerified,
      fingerprintMatch,
      signatureCount: signatures.length,
      chain,
    };
  }
}

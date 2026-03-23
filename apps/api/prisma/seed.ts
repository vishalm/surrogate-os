import { PrismaClient } from '@prisma/client';
import { TenantManager } from '../src/tenancy/tenant-manager.js';
import { hashPassword, computeAuditHash } from '../src/lib/crypto.js';
import { AuditAction, SOPNodeType } from '@surrogate-os/shared';

const prisma = new PrismaClient();
const tenantManager = new TenantManager(prisma);

async function main() {
  console.log('Seeding database...');

  // 1. Create test org "Acme Healthcare"
  const org = await prisma.org.upsert({
    where: { slug: 'acme-healthcare' },
    update: {},
    create: {
      name: 'Acme Healthcare',
      slug: 'acme-healthcare',
      plan: 'ENTERPRISE',
      settings: {},
      schemaName: 'tenant_acme_healthcare',
    },
  });
  console.log(`Created org: ${org.name} (${org.id})`);

  // 2. Create test user admin@acme.com
  const passwordHash = await hashPassword('Password123!');
  const user = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      email: 'admin@acme.com',
      name: 'Acme Admin',
      passwordHash,
      orgId: org.id,
      role: 'OWNER',
    },
  });
  console.log(`Created user: ${user.email} (${user.id})`);

  // 3. Create tenant schema
  const schemaName = await tenantManager.createTenantSchema('acme-healthcare');
  console.log(`Created tenant schema: ${schemaName}`);

  // 4. Insert 3 surrogates via raw SQL in tenant
  const surrogates = await tenantManager.executeInTenant<{ id: string }[]>(
    'acme-healthcare',
    `INSERT INTO surrogates (role_title, domain, jurisdiction, status, config)
     VALUES
       ('Senior ER Nurse', 'healthcare', 'NHS_UK', 'ACTIVE', $1::jsonb),
       ('M&A Legal Advisor', 'legal', 'UK_SRA', 'DRAFT', $2::jsonb),
       ('Compliance Officer', 'finance', 'US_SEC', 'ACTIVE', $3::jsonb)
     RETURNING id`,
    [
      JSON.stringify({
        seniority: 'senior',
        certifications: ['NMC', 'ALS', 'PILS'],
        communicationStyle: 'calm and professional',
        assertiveness: 7,
        empathyLevel: 9,
        riskTolerance: 'low',
        escalationThreshold: 0.3,
      }),
      JSON.stringify({
        seniority: 'partner',
        certifications: ['SRA', 'CFA'],
        communicationStyle: 'formal and precise',
        assertiveness: 8,
        empathyLevel: 5,
        riskTolerance: 'medium',
        escalationThreshold: 0.5,
      }),
      JSON.stringify({
        seniority: 'mid',
        certifications: ['SEC_Series7', 'CAMS'],
        communicationStyle: 'structured and methodical',
        assertiveness: 6,
        empathyLevel: 6,
        riskTolerance: 'low',
        escalationThreshold: 0.25,
      }),
    ],
  );
  const nurseSurrogateId = surrogates[0].id;
  console.log(`Created ${surrogates.length} surrogates`);

  // 5. Insert 2 SOPs for the nurse surrogate with realistic SOPGraph data
  const sopGraph1 = {
    nodes: [
      { id: 'gather-vitals', type: SOPNodeType.INFORMATION_GATHER, label: 'Gather Patient Vitals', description: 'Collect initial patient vital signs including BP, HR, SpO2, temperature, and respiratory rate', config: { requiredFields: ['bp', 'hr', 'spo2', 'temp', 'rr'] } },
      { id: 'assess-patient-vitals', type: SOPNodeType.ASSESSMENT, label: 'Assess Patient Vitals', description: 'Evaluate vital signs against normal ranges and flag abnormalities', config: { thresholds: { hrLow: 60, hrHigh: 100, spo2Low: 94 } } },
      { id: 'triage-decision', type: SOPNodeType.DECISION, label: 'Triage Decision', description: 'Determine urgency level based on assessment: immediate, urgent, or standard', config: { options: ['immediate', 'urgent', 'standard'] } },
      { id: 'administer-treatment', type: SOPNodeType.ACTION_DIGITAL, label: 'Order Standard Treatment', description: 'Submit standard treatment orders through the hospital EHR system', config: { system: 'EHR' } },
      { id: 'escalate-to-doctor', type: SOPNodeType.ESCALATION, label: 'Escalate to Attending Physician', description: 'Immediately escalate critical patient to attending physician with full vitals summary', config: { urgency: 'critical', targetRole: 'attending_physician' } },
      { id: 'verify-treatment', type: SOPNodeType.CHECKPOINT, label: 'Verify Treatment Administered', description: 'Confirm treatment was administered correctly and patient response is as expected', config: { requiresSignoff: true } },
      { id: 'document-encounter', type: SOPNodeType.DOCUMENTATION, label: 'Document Patient Encounter', description: 'Record full encounter details in patient medical record', config: { template: 'er_encounter' } },
    ],
    edges: [
      { id: 'e1', from: 'gather-vitals', to: 'assess-patient-vitals', condition: null, label: null },
      { id: 'e2', from: 'assess-patient-vitals', to: 'triage-decision', condition: null, label: null },
      { id: 'e3', from: 'triage-decision', to: 'administer-treatment', condition: 'standard or urgent', label: 'Standard Path' },
      { id: 'e4', from: 'triage-decision', to: 'escalate-to-doctor', condition: 'immediate', label: 'Critical Path' },
      { id: 'e5', from: 'administer-treatment', to: 'verify-treatment', condition: null, label: null },
      { id: 'e6', from: 'verify-treatment', to: 'document-encounter', condition: null, label: null },
    ],
  };

  const sopGraph2 = {
    nodes: [
      { id: 'check-drug-interactions', type: SOPNodeType.INFORMATION_GATHER, label: 'Check Drug Interactions', description: 'Query drug interaction database for patient current medications and proposed prescription', config: { database: 'BNF' } },
      { id: 'assess-interaction-risk', type: SOPNodeType.ASSESSMENT, label: 'Assess Interaction Risk', description: 'Evaluate severity of any detected drug interactions', config: { severityLevels: ['none', 'minor', 'moderate', 'severe'] } },
      { id: 'interaction-decision', type: SOPNodeType.DECISION, label: 'Proceed or Modify', description: 'Decide whether to proceed with prescription, modify dosage, or choose alternative', config: {} },
      { id: 'dispense-medication', type: SOPNodeType.ACTION_DIGITAL, label: 'Dispense Medication', description: 'Send prescription to pharmacy system for dispensing', config: { system: 'pharmacy' } },
      { id: 'pharmacist-review', type: SOPNodeType.CHECKPOINT, label: 'Pharmacist Review', description: 'Pharmacist reviews and confirms the prescription before dispensing', config: { requiresSignoff: true } },
      { id: 'escalate-severe', type: SOPNodeType.ESCALATION, label: 'Escalate Severe Interaction', description: 'Escalate to senior pharmacist or prescribing physician for severe interaction', config: { urgency: 'high' } },
      { id: 'record-dispensing', type: SOPNodeType.DOCUMENTATION, label: 'Record Dispensing', description: 'Document medication dispensing event in patient record', config: {} },
    ],
    edges: [
      { id: 'e1', from: 'check-drug-interactions', to: 'assess-interaction-risk', condition: null, label: null },
      { id: 'e2', from: 'assess-interaction-risk', to: 'interaction-decision', condition: null, label: null },
      { id: 'e3', from: 'interaction-decision', to: 'dispense-medication', condition: 'no significant interaction', label: 'Safe' },
      { id: 'e4', from: 'interaction-decision', to: 'escalate-severe', condition: 'severe interaction detected', label: 'Escalate' },
      { id: 'e5', from: 'dispense-medication', to: 'pharmacist-review', condition: null, label: null },
      { id: 'e6', from: 'pharmacist-review', to: 'record-dispensing', condition: null, label: null },
    ],
  };

  const sopHash1 = computeAuditHash(null, 'SOP_CREATED', new Date(), nurseSurrogateId);
  const sopHash2 = computeAuditHash(sopHash1, 'SOP_CREATED', new Date(), nurseSurrogateId);

  await tenantManager.executeInTenant(
    'acme-healthcare',
    `INSERT INTO sops (surrogate_id, version, status, title, description, graph, hash)
     VALUES
       ($1, 1, 'CERTIFIED', 'ER Patient Triage Protocol', 'Standard operating procedure for triaging patients in the emergency room based on vital signs assessment', $2::jsonb, $3),
       ($1, 1, 'DRAFT', 'Drug Interaction Check Protocol', 'Procedure for checking and handling drug interactions before dispensing medication', $4::jsonb, $5)`,
    [
      nurseSurrogateId,
      JSON.stringify(sopGraph1),
      sopHash1,
      JSON.stringify(sopGraph2),
      sopHash2,
    ],
  );
  console.log('Created 2 SOPs for Senior ER Nurse surrogate');

  // 6. Insert 5 audit entries with proper hash chaining
  const auditActions: { action: AuditAction; details: Record<string, unknown>; surrogateId: string | null }[] = [
    {
      action: AuditAction.SURROGATE_CREATED,
      details: { roleTitle: 'Senior ER Nurse', domain: 'healthcare' },
      surrogateId: nurseSurrogateId,
    },
    {
      action: AuditAction.SOP_CREATED,
      details: { title: 'ER Patient Triage Protocol', version: 1 },
      surrogateId: nurseSurrogateId,
    },
    {
      action: AuditAction.SOP_CERTIFIED,
      details: { title: 'ER Patient Triage Protocol', certifiedBy: user.id },
      surrogateId: nurseSurrogateId,
    },
    {
      action: AuditAction.SOP_CREATED,
      details: { title: 'Drug Interaction Check Protocol', version: 1 },
      surrogateId: nurseSurrogateId,
    },
    {
      action: AuditAction.USER_LOGIN,
      details: { email: 'admin@acme.com', ip: '192.168.1.1' },
      surrogateId: null,
    },
  ];

  let previousHash: string | null = null;
  for (const entry of auditActions) {
    const now = new Date();
    const hash = computeAuditHash(previousHash, entry.action, now, entry.surrogateId);
    await tenantManager.executeInTenant(
      'acme-healthcare',
      `INSERT INTO audit_entries (surrogate_id, user_id, action, details, previous_hash, hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entry.surrogateId, user.id, entry.action, JSON.stringify(entry.details), previousHash, hash, now],
    );
    previousHash = hash;
  }
  console.log('Created 5 audit entries with hash chaining');

  console.log('Seed complete!');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

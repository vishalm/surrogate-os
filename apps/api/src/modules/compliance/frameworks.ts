export type ComplianceCategory =
  | 'DATA_PROTECTION'
  | 'AUDIT_TRAIL'
  | 'HUMAN_OVERSIGHT'
  | 'RISK_MANAGEMENT'
  | 'REPORTING'
  | 'ACCESS_CONTROL';

export type ComplianceSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  category: ComplianceCategory;
  severity: ComplianceSeverity;
  checkFunction: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  jurisdiction: string;
  domain: string;
  version: string;
  requirements: ComplianceRequirement[];
}

// ---------------------------------------------------------------------------
// Built-in regulatory frameworks
// ---------------------------------------------------------------------------

export const BUILT_IN_FRAMEWORKS: ComplianceFramework[] = [
  // ---- NHS / CQC (UK Healthcare) ----
  {
    id: 'cqc-uk',
    name: 'CQC Standards',
    jurisdiction: 'UK',
    domain: 'healthcare',
    version: '2024.1',
    requirements: [
      {
        id: 'cqc-uk-001',
        title: 'Patient Consent Tracking',
        description: 'All surrogate interactions involving patient data must have explicit consent recorded in the audit trail.',
        category: 'DATA_PROTECTION',
        severity: 'CRITICAL',
        checkFunction: 'checkConsentTracking',
      },
      {
        id: 'cqc-uk-002',
        title: 'Clinical Decision Audit Trail',
        description: 'Every clinical decision made by a surrogate must be logged with rationale, confidence score, and SOP node reference.',
        category: 'AUDIT_TRAIL',
        severity: 'CRITICAL',
        checkFunction: 'checkDecisionAuditTrail',
      },
      {
        id: 'cqc-uk-003',
        title: 'Human Escalation for High-Risk Decisions',
        description: 'Surrogates must escalate decisions above the configured risk threshold to a qualified human professional.',
        category: 'HUMAN_OVERSIGHT',
        severity: 'HIGH',
        checkFunction: 'checkEscalationThreshold',
      },
      {
        id: 'cqc-uk-004',
        title: 'SOP Certification Required',
        description: 'All active SOPs must be in CERTIFIED status before a surrogate can be activated.',
        category: 'RISK_MANAGEMENT',
        severity: 'HIGH',
        checkFunction: 'checkSOPCertification',
      },
      {
        id: 'cqc-uk-005',
        title: 'Data Retention Compliance',
        description: 'Audit entries must be retained for a minimum of 8 years for healthcare records.',
        category: 'REPORTING',
        severity: 'MEDIUM',
        checkFunction: 'checkDataRetention',
      },
      {
        id: 'cqc-uk-006',
        title: 'Role-Based Access Control',
        description: 'Access to surrogate configuration and patient-facing SOPs must be restricted by organizational role.',
        category: 'ACCESS_CONTROL',
        severity: 'HIGH',
        checkFunction: 'checkRoleBasedAccess',
      },
    ],
  },

  // ---- HIPAA (US Healthcare) ----
  {
    id: 'hipaa-us',
    name: 'HIPAA Compliance',
    jurisdiction: 'US',
    domain: 'healthcare',
    version: '2024.1',
    requirements: [
      {
        id: 'hipaa-us-001',
        title: 'Protected Health Information (PHI) Safeguards',
        description: 'All surrogate interactions that process PHI must have encryption at rest and in transit verified.',
        category: 'DATA_PROTECTION',
        severity: 'CRITICAL',
        checkFunction: 'checkPHISafeguards',
      },
      {
        id: 'hipaa-us-002',
        title: 'Access Logging for PHI',
        description: 'Every access to protected health information must be logged with user identity, timestamp, and purpose.',
        category: 'AUDIT_TRAIL',
        severity: 'CRITICAL',
        checkFunction: 'checkPHIAccessLogging',
      },
      {
        id: 'hipaa-us-003',
        title: 'Minimum Necessary Standard',
        description: 'Surrogates must only access the minimum necessary PHI required to complete their assigned SOP task.',
        category: 'ACCESS_CONTROL',
        severity: 'HIGH',
        checkFunction: 'checkMinimumNecessary',
      },
      {
        id: 'hipaa-us-004',
        title: 'Breach Notification Readiness',
        description: 'System must support breach notification workflows with audit evidence export within 60 days.',
        category: 'REPORTING',
        severity: 'HIGH',
        checkFunction: 'checkBreachNotificationReadiness',
      },
      {
        id: 'hipaa-us-005',
        title: 'Risk Assessment Documentation',
        description: 'Periodic risk assessments must be documented for each active surrogate handling PHI.',
        category: 'RISK_MANAGEMENT',
        severity: 'MEDIUM',
        checkFunction: 'checkRiskAssessment',
      },
      {
        id: 'hipaa-us-006',
        title: 'Human Override Capability',
        description: 'Human operators must be able to override any surrogate decision involving patient care at any time.',
        category: 'HUMAN_OVERSIGHT',
        severity: 'CRITICAL',
        checkFunction: 'checkHumanOverride',
      },
    ],
  },

  // ---- FCA (UK Finance) ----
  {
    id: 'fca-uk',
    name: 'FCA Regulations',
    jurisdiction: 'UK',
    domain: 'finance',
    version: '2024.1',
    requirements: [
      {
        id: 'fca-uk-001',
        title: 'Client Outcome Monitoring',
        description: 'All surrogate decisions affecting client outcomes must be tracked and reportable for Consumer Duty compliance.',
        category: 'REPORTING',
        severity: 'CRITICAL',
        checkFunction: 'checkClientOutcomeMonitoring',
      },
      {
        id: 'fca-uk-002',
        title: 'Senior Management Accountability',
        description: 'Surrogate actions must be attributable to a named Senior Manager under the SM&CR regime.',
        category: 'HUMAN_OVERSIGHT',
        severity: 'HIGH',
        checkFunction: 'checkSeniorManagerAccountability',
      },
      {
        id: 'fca-uk-003',
        title: 'Transaction Audit Trail',
        description: 'All financial transactions processed by surrogates must have immutable, tamper-evident audit records.',
        category: 'AUDIT_TRAIL',
        severity: 'CRITICAL',
        checkFunction: 'checkTransactionAuditTrail',
      },
      {
        id: 'fca-uk-004',
        title: 'Fair Treatment of Customers',
        description: 'Surrogates must demonstrate unbiased treatment across all customer segments via bias audit checks.',
        category: 'RISK_MANAGEMENT',
        severity: 'HIGH',
        checkFunction: 'checkFairTreatment',
      },
      {
        id: 'fca-uk-005',
        title: 'Data Subject Access Requests',
        description: 'System must support extracting all surrogate interactions for a given customer within 30 days.',
        category: 'DATA_PROTECTION',
        severity: 'MEDIUM',
        checkFunction: 'checkDSARCapability',
      },
    ],
  },

  // ---- SOX (US Finance) ----
  {
    id: 'sox-us',
    name: 'SOX Compliance',
    jurisdiction: 'US',
    domain: 'finance',
    version: '2024.1',
    requirements: [
      {
        id: 'sox-us-001',
        title: 'Internal Controls over Financial Reporting',
        description: 'Surrogate-generated financial reports must have verifiable internal controls and approval chains.',
        category: 'REPORTING',
        severity: 'CRITICAL',
        checkFunction: 'checkInternalControls',
      },
      {
        id: 'sox-us-002',
        title: 'Segregation of Duties',
        description: 'No single surrogate or user should have both creation and approval authority for financial transactions.',
        category: 'ACCESS_CONTROL',
        severity: 'CRITICAL',
        checkFunction: 'checkSegregationOfDuties',
      },
      {
        id: 'sox-us-003',
        title: 'Change Management Audit Trail',
        description: 'All changes to SOPs that govern financial processes must be versioned, reviewed, and signed.',
        category: 'AUDIT_TRAIL',
        severity: 'HIGH',
        checkFunction: 'checkChangeManagement',
      },
      {
        id: 'sox-us-004',
        title: 'Management Certification',
        description: 'Management must certify the accuracy of surrogate-assisted financial reports via SOP signing.',
        category: 'HUMAN_OVERSIGHT',
        severity: 'HIGH',
        checkFunction: 'checkManagementCertification',
      },
      {
        id: 'sox-us-005',
        title: 'Record Retention (7 Years)',
        description: 'All audit entries related to financial operations must be retained for a minimum of 7 years.',
        category: 'DATA_PROTECTION',
        severity: 'MEDIUM',
        checkFunction: 'checkRecordRetention',
      },
    ],
  },

  // ---- GDPR (EU Data) ----
  {
    id: 'gdpr-eu',
    name: 'GDPR',
    jurisdiction: 'EU',
    domain: 'general',
    version: '2024.1',
    requirements: [
      {
        id: 'gdpr-eu-001',
        title: 'Lawful Basis for Processing',
        description: 'Each surrogate must have a documented lawful basis for processing personal data in its SOP configuration.',
        category: 'DATA_PROTECTION',
        severity: 'CRITICAL',
        checkFunction: 'checkLawfulBasis',
      },
      {
        id: 'gdpr-eu-002',
        title: 'Right to Explanation (Automated Decisions)',
        description: 'Surrogates making automated decisions must provide meaningful explanations logged in the audit trail.',
        category: 'AUDIT_TRAIL',
        severity: 'CRITICAL',
        checkFunction: 'checkRightToExplanation',
      },
      {
        id: 'gdpr-eu-003',
        title: 'Data Minimisation',
        description: 'Surrogate configurations must specify minimum data requirements; no excess personal data should be processed.',
        category: 'DATA_PROTECTION',
        severity: 'HIGH',
        checkFunction: 'checkDataMinimisation',
      },
      {
        id: 'gdpr-eu-004',
        title: 'Human Review of Automated Decisions',
        description: 'Data subjects must have the right to request human review of significant automated decisions.',
        category: 'HUMAN_OVERSIGHT',
        severity: 'HIGH',
        checkFunction: 'checkHumanReviewRight',
      },
      {
        id: 'gdpr-eu-005',
        title: 'Data Processing Records',
        description: 'Comprehensive records of processing activities must be maintained and exportable.',
        category: 'REPORTING',
        severity: 'MEDIUM',
        checkFunction: 'checkProcessingRecords',
      },
      {
        id: 'gdpr-eu-006',
        title: 'Data Protection Impact Assessment',
        description: 'High-risk surrogate deployments must have a completed Data Protection Impact Assessment.',
        category: 'RISK_MANAGEMENT',
        severity: 'HIGH',
        checkFunction: 'checkDPIA',
      },
    ],
  },

  // ---- EU AI Act ----
  {
    id: 'eu-ai-act',
    name: 'EU AI Act',
    jurisdiction: 'EU',
    domain: 'general',
    version: '2024.1',
    requirements: [
      {
        id: 'eu-ai-001',
        title: 'AI System Risk Classification',
        description: 'Each surrogate must be classified by risk level (unacceptable, high, limited, minimal) with documentation.',
        category: 'RISK_MANAGEMENT',
        severity: 'CRITICAL',
        checkFunction: 'checkAIRiskClassification',
      },
      {
        id: 'eu-ai-002',
        title: 'Transparency Obligations',
        description: 'Users interacting with surrogates must be informed they are interacting with an AI system.',
        category: 'REPORTING',
        severity: 'HIGH',
        checkFunction: 'checkTransparencyDisclosure',
      },
      {
        id: 'eu-ai-003',
        title: 'Human Oversight Mechanisms',
        description: 'High-risk AI surrogates must have effective human oversight with the ability to intervene or override.',
        category: 'HUMAN_OVERSIGHT',
        severity: 'CRITICAL',
        checkFunction: 'checkHumanOversightMechanism',
      },
      {
        id: 'eu-ai-004',
        title: 'Technical Documentation',
        description: 'Complete technical documentation must exist for each surrogate including training data, design choices, and performance metrics.',
        category: 'AUDIT_TRAIL',
        severity: 'HIGH',
        checkFunction: 'checkTechnicalDocumentation',
      },
      {
        id: 'eu-ai-005',
        title: 'Bias and Fairness Monitoring',
        description: 'Ongoing monitoring for bias in decision-making must be implemented with regular audits.',
        category: 'RISK_MANAGEMENT',
        severity: 'HIGH',
        checkFunction: 'checkBiasFairnessMonitoring',
      },
      {
        id: 'eu-ai-006',
        title: 'Logging and Traceability',
        description: 'High-risk AI systems must maintain logs enabling traceability of decisions throughout the system lifecycle.',
        category: 'AUDIT_TRAIL',
        severity: 'CRITICAL',
        checkFunction: 'checkLoggingTraceability',
      },
    ],
  },
];

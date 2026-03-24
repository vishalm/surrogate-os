import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_FRAMEWORKS,
  type ComplianceFramework,
  type ComplianceCategory,
  type ComplianceSeverity,
} from './frameworks.js';

const EXPECTED_FRAMEWORK_IDS = ['cqc-uk', 'hipaa-us', 'fca-uk', 'sox-us', 'gdpr-eu', 'eu-ai-act'];

const VALID_CATEGORIES: ComplianceCategory[] = [
  'DATA_PROTECTION',
  'AUDIT_TRAIL',
  'HUMAN_OVERSIGHT',
  'RISK_MANAGEMENT',
  'REPORTING',
  'ACCESS_CONTROL',
];

const VALID_SEVERITIES: ComplianceSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

describe('BUILT_IN_FRAMEWORKS', () => {
  it('contains exactly 6 frameworks', () => {
    expect(BUILT_IN_FRAMEWORKS).toHaveLength(6);
  });

  it.each(EXPECTED_FRAMEWORK_IDS)('contains framework with id "%s"', (id) => {
    const fw = BUILT_IN_FRAMEWORKS.find((f) => f.id === id);
    expect(fw).toBeDefined();
  });

  it('has no duplicate framework IDs', () => {
    const ids = BUILT_IN_FRAMEWORKS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(BUILT_IN_FRAMEWORKS)('framework "$name" ($id)', (framework: ComplianceFramework) => {
    it('has valid structure with all required fields', () => {
      expect(framework.id).toBeTruthy();
      expect(typeof framework.id).toBe('string');
      expect(framework.name).toBeTruthy();
      expect(typeof framework.name).toBe('string');
      expect(framework.jurisdiction).toBeTruthy();
      expect(typeof framework.jurisdiction).toBe('string');
      expect(framework.domain).toBeTruthy();
      expect(typeof framework.domain).toBe('string');
      expect(framework.version).toBeTruthy();
      expect(typeof framework.version).toBe('string');
    });

    it('has at least 4 requirements', () => {
      expect(framework.requirements.length).toBeGreaterThanOrEqual(4);
    });

    it('has no duplicate requirement IDs', () => {
      const ids = framework.requirements.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has valid category for every requirement', () => {
      for (const req of framework.requirements) {
        expect(VALID_CATEGORIES).toContain(req.category);
      }
    });

    it('has valid severity for every requirement', () => {
      for (const req of framework.requirements) {
        expect(VALID_SEVERITIES).toContain(req.severity);
      }
    });

    it('has non-empty title, description, and checkFunction for every requirement', () => {
      for (const req of framework.requirements) {
        expect(req.id).toBeTruthy();
        expect(req.title).toBeTruthy();
        expect(req.description).toBeTruthy();
        expect(req.checkFunction).toBeTruthy();
      }
    });
  });

  it('has no duplicate requirement IDs across ALL frameworks', () => {
    const allIds = BUILT_IN_FRAMEWORKS.flatMap((f) => f.requirements.map((r) => r.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe('domain filtering', () => {
  it('finds healthcare frameworks (CQC and HIPAA)', () => {
    const healthcare = BUILT_IN_FRAMEWORKS.filter((f) => f.domain === 'healthcare');
    expect(healthcare).toHaveLength(2);
    const ids = healthcare.map((f) => f.id).sort();
    expect(ids).toEqual(['cqc-uk', 'hipaa-us']);
  });

  it('finds finance frameworks (FCA and SOX)', () => {
    const finance = BUILT_IN_FRAMEWORKS.filter((f) => f.domain === 'finance');
    expect(finance).toHaveLength(2);
    const ids = finance.map((f) => f.id).sort();
    expect(ids).toEqual(['fca-uk', 'sox-us']);
  });

  it('finds general-domain frameworks (GDPR and EU AI Act)', () => {
    const general = BUILT_IN_FRAMEWORKS.filter((f) => f.domain === 'general');
    expect(general).toHaveLength(2);
    const ids = general.map((f) => f.id).sort();
    expect(ids).toEqual(['eu-ai-act', 'gdpr-eu']);
  });
});

describe('jurisdiction filtering', () => {
  it('finds UK frameworks (CQC and FCA)', () => {
    const uk = BUILT_IN_FRAMEWORKS.filter((f) => f.jurisdiction === 'UK');
    expect(uk).toHaveLength(2);
    const ids = uk.map((f) => f.id).sort();
    expect(ids).toEqual(['cqc-uk', 'fca-uk']);
  });

  it('finds US frameworks (HIPAA and SOX)', () => {
    const us = BUILT_IN_FRAMEWORKS.filter((f) => f.jurisdiction === 'US');
    expect(us).toHaveLength(2);
    const ids = us.map((f) => f.id).sort();
    expect(ids).toEqual(['hipaa-us', 'sox-us']);
  });

  it('finds EU frameworks (GDPR and EU AI Act)', () => {
    const eu = BUILT_IN_FRAMEWORKS.filter((f) => f.jurisdiction === 'EU');
    expect(eu).toHaveLength(2);
    const ids = eu.map((f) => f.id).sort();
    expect(ids).toEqual(['eu-ai-act', 'gdpr-eu']);
  });
});

describe('getFrameworkById (via array lookup)', () => {
  it('finds CQC by id', () => {
    const fw = BUILT_IN_FRAMEWORKS.find((f) => f.id === 'cqc-uk');
    expect(fw).toBeDefined();
    expect(fw!.name).toBe('CQC Standards');
    expect(fw!.jurisdiction).toBe('UK');
    expect(fw!.domain).toBe('healthcare');
  });

  it('finds HIPAA by id', () => {
    const fw = BUILT_IN_FRAMEWORKS.find((f) => f.id === 'hipaa-us');
    expect(fw).toBeDefined();
    expect(fw!.name).toBe('HIPAA Compliance');
  });

  it('finds EU AI Act by id', () => {
    const fw = BUILT_IN_FRAMEWORKS.find((f) => f.id === 'eu-ai-act');
    expect(fw).toBeDefined();
    expect(fw!.name).toBe('EU AI Act');
  });

  it('returns undefined for unknown id', () => {
    const fw = BUILT_IN_FRAMEWORKS.find((f) => f.id === 'nonexistent');
    expect(fw).toBeUndefined();
  });
});

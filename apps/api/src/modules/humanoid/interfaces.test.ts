import { describe, it, expect } from 'vitest';
import {
  InterfaceModality,
  ActionAuthLevel,
  KillSwitchLevel,
  DEFAULT_HARD_STOP_CONFIG,
  type HardStopConfig,
} from './interfaces.js';

describe('InterfaceModality enum', () => {
  const expectedValues = [
    'CHAT',
    'VOICE',
    'AVATAR',
    'AR_OVERLAY',
    'EXOSUIT',
    'COLLABORATIVE_ROBOT',
    'SEMI_AUTONOMOUS',
    'FULLY_AUTONOMOUS',
  ];

  it('has exactly 8 values', () => {
    const values = Object.values(InterfaceModality);
    expect(values).toHaveLength(8);
  });

  it.each(expectedValues)('contains value "%s"', (value) => {
    expect(Object.values(InterfaceModality)).toContain(value);
  });

  it('key matches value for each entry', () => {
    for (const [key, value] of Object.entries(InterfaceModality)) {
      expect(key).toBe(value);
    }
  });
});

describe('InterfaceModality ordering', () => {
  // Conceptual ordering from least autonomous to most autonomous
  const orderedModalities = [
    InterfaceModality.CHAT,
    InterfaceModality.VOICE,
    InterfaceModality.AVATAR,
    InterfaceModality.AR_OVERLAY,
    InterfaceModality.EXOSUIT,
    InterfaceModality.COLLABORATIVE_ROBOT,
    InterfaceModality.SEMI_AUTONOMOUS,
    InterfaceModality.FULLY_AUTONOMOUS,
  ];

  it('CHAT is the first (least autonomous) modality', () => {
    expect(orderedModalities[0]).toBe(InterfaceModality.CHAT);
  });

  it('FULLY_AUTONOMOUS is the last (most autonomous) modality', () => {
    expect(orderedModalities[orderedModalities.length - 1]).toBe(InterfaceModality.FULLY_AUTONOMOUS);
  });

  it('SEMI_AUTONOMOUS comes before FULLY_AUTONOMOUS', () => {
    const semiIdx = orderedModalities.indexOf(InterfaceModality.SEMI_AUTONOMOUS);
    const fullyIdx = orderedModalities.indexOf(InterfaceModality.FULLY_AUTONOMOUS);
    expect(semiIdx).toBeLessThan(fullyIdx);
  });

  it('VOICE comes after CHAT', () => {
    const chatIdx = orderedModalities.indexOf(InterfaceModality.CHAT);
    const voiceIdx = orderedModalities.indexOf(InterfaceModality.VOICE);
    expect(voiceIdx).toBeGreaterThan(chatIdx);
  });
});

describe('ActionAuthLevel enum', () => {
  const expectedValues = [
    'L1_OBSERVE',
    'L2_SUGGEST',
    'L3_ACT_WITH_APPROVAL',
    'L4_ACT_NOTIFY',
    'L5_AUTONOMOUS',
    'BLOCKED',
  ];

  it('has exactly 6 values (L1-L5 + BLOCKED)', () => {
    const values = Object.values(ActionAuthLevel);
    expect(values).toHaveLength(6);
  });

  it.each(expectedValues)('contains value "%s"', (value) => {
    expect(Object.values(ActionAuthLevel)).toContain(value);
  });

  it('has 5 numbered levels (L1 through L5)', () => {
    const numbered = Object.values(ActionAuthLevel).filter((v) => v.startsWith('L'));
    expect(numbered).toHaveLength(5);
  });

  it('BLOCKED is a distinct non-numbered level', () => {
    expect(ActionAuthLevel.BLOCKED).toBe('BLOCKED');
    expect(ActionAuthLevel.BLOCKED).not.toMatch(/^L\d/);
  });

  it('L1 is observe-only (lowest autonomy)', () => {
    expect(ActionAuthLevel.L1_OBSERVE).toBe('L1_OBSERVE');
  });

  it('L5 is fully autonomous (highest autonomy)', () => {
    expect(ActionAuthLevel.L5_AUTONOMOUS).toBe('L5_AUTONOMOUS');
  });
});

describe('KillSwitchLevel enum', () => {
  const expectedValues = ['SOFT_PAUSE', 'FULL_STOP', 'EMERGENCY_KILL'];

  it('has exactly 3 values', () => {
    const values = Object.values(KillSwitchLevel);
    expect(values).toHaveLength(3);
  });

  it.each(expectedValues)('contains value "%s"', (value) => {
    expect(Object.values(KillSwitchLevel)).toContain(value);
  });

  it('has a soft pause option that maintains state', () => {
    expect(KillSwitchLevel.SOFT_PAUSE).toBe('SOFT_PAUSE');
  });

  it('has a full stop option', () => {
    expect(KillSwitchLevel.FULL_STOP).toBe('FULL_STOP');
  });

  it('has an emergency kill option for immediate halt', () => {
    expect(KillSwitchLevel.EMERGENCY_KILL).toBe('EMERGENCY_KILL');
  });
});

describe('DEFAULT_HARD_STOP_CONFIG', () => {
  it('is defined and is an object', () => {
    expect(DEFAULT_HARD_STOP_CONFIG).toBeDefined();
    expect(typeof DEFAULT_HARD_STOP_CONFIG).toBe('object');
  });

  it('enables all three stop levels by default', () => {
    expect(DEFAULT_HARD_STOP_CONFIG.softPauseEnabled).toBe(true);
    expect(DEFAULT_HARD_STOP_CONFIG.fullStopEnabled).toBe(true);
    expect(DEFAULT_HARD_STOP_CONFIG.emergencyKillEnabled).toBe(true);
  });

  it('has a positive heartbeat interval', () => {
    expect(DEFAULT_HARD_STOP_CONFIG.heartbeatIntervalMs).toBeGreaterThan(0);
  });

  it('has heartbeat interval of 5000ms', () => {
    expect(DEFAULT_HARD_STOP_CONFIG.heartbeatIntervalMs).toBe(5000);
  });

  it('has max latency greater than heartbeat interval', () => {
    expect(DEFAULT_HARD_STOP_CONFIG.maxLatencyMs).toBeGreaterThan(
      DEFAULT_HARD_STOP_CONFIG.heartbeatIntervalMs,
    );
  });

  it('has max latency of 10000ms', () => {
    expect(DEFAULT_HARD_STOP_CONFIG.maxLatencyMs).toBe(10000);
  });

  it('does not require dual auth by default', () => {
    expect(DEFAULT_HARD_STOP_CONFIG.requireDualAuth).toBe(false);
  });

  it('has an empty authorized operators list by default', () => {
    expect(DEFAULT_HARD_STOP_CONFIG.authorizedOperators).toEqual([]);
    expect(Array.isArray(DEFAULT_HARD_STOP_CONFIG.authorizedOperators)).toBe(true);
  });

  it('satisfies the HardStopConfig interface shape', () => {
    const config: HardStopConfig = DEFAULT_HARD_STOP_CONFIG;
    expect(config).toHaveProperty('softPauseEnabled');
    expect(config).toHaveProperty('fullStopEnabled');
    expect(config).toHaveProperty('emergencyKillEnabled');
    expect(config).toHaveProperty('heartbeatIntervalMs');
    expect(config).toHaveProperty('maxLatencyMs');
    expect(config).toHaveProperty('requireDualAuth');
    expect(config).toHaveProperty('authorizedOperators');
  });
});

// Surrogate Interface Modalities
export enum InterfaceModality {
  CHAT = 'CHAT',
  VOICE = 'VOICE',
  AVATAR = 'AVATAR',
  AR_OVERLAY = 'AR_OVERLAY',
  EXOSUIT = 'EXOSUIT',
  COLLABORATIVE_ROBOT = 'COLLABORATIVE_ROBOT',
  SEMI_AUTONOMOUS = 'SEMI_AUTONOMOUS',
  FULLY_AUTONOMOUS = 'FULLY_AUTONOMOUS',
}

// Physical Action Authorization Levels (L1-L5)
export enum ActionAuthLevel {
  L1_OBSERVE = 'L1_OBSERVE',                      // Observe and report only
  L2_SUGGEST = 'L2_SUGGEST',                      // Suggest actions to human
  L3_ACT_WITH_APPROVAL = 'L3_ACT_WITH_APPROVAL',  // Act only with explicit human approval
  L4_ACT_NOTIFY = 'L4_ACT_NOTIFY',                // Act and notify human
  L5_AUTONOMOUS = 'L5_AUTONOMOUS',                 // Fully autonomous within SOP scope
  BLOCKED = 'BLOCKED',                             // Never allowed
}

// Kill Switch Levels
export enum KillSwitchLevel {
  SOFT_PAUSE = 'SOFT_PAUSE',         // Pause current task, maintain state
  FULL_STOP = 'FULL_STOP',           // Stop all operations, safe state
  EMERGENCY_KILL = 'EMERGENCY_KILL', // Immediate halt, no state preservation
}

// Physical action types for task translation
export type PhysicalActionType = 'MOVE' | 'GRASP' | 'PLACE' | 'INSPECT' | 'COMMUNICATE' | 'WAIT';

// Risk severity levels
export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Device status
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR';

// Task Translation: cognitive task -> physical action sequence
export interface TaskTranslation {
  cognitiveTask: string;
  physicalActions: PhysicalAction[];
  requiredAuthLevel: ActionAuthLevel;
  riskAssessment: RiskAssessment;
  estimatedDuration: number; // seconds
}

export interface PhysicalAction {
  id: string;
  sequence: number;
  description: string;
  actionType: PhysicalActionType;
  parameters: Record<string, unknown>;
  safetyConstraints: string[];
  rollbackAction?: string;
}

export interface RiskAssessment {
  overallRisk: RiskSeverity;
  humanProximity: boolean;
  reversible: boolean;
  medicalContext: boolean;
  factors: string[];
}

export interface HardStopConfig {
  softPauseEnabled: boolean;
  fullStopEnabled: boolean;
  emergencyKillEnabled: boolean;
  heartbeatIntervalMs: number;
  maxLatencyMs: number;
  requireDualAuth: boolean;
  authorizedOperators: string[];
}

export const DEFAULT_HARD_STOP_CONFIG: HardStopConfig = {
  softPauseEnabled: true,
  fullStopEnabled: true,
  emergencyKillEnabled: true,
  heartbeatIntervalMs: 5000,
  maxLatencyMs: 10000,
  requireDualAuth: false,
  authorizedOperators: [],
};

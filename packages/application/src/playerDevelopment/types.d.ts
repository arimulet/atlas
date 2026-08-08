import { type SnapshotSkillSet, type PersistedPlayerSnapshot } from "@atlas/database";
import { Confidence } from "../types";

type SkillKey = keyof SnapshotSkillSet;
type SkillChangeDirection = "up" | "down" | "stable" | "insufficient_data";
export type DevelopmentFindingType = "improvement" | "stagnation" | "decline" | "insufficient_data";

export interface GetPlayerDevelopmentInput {
  clubId: string;
}

export interface PlayerDevelopment {
  clubId: string;
  snapshotCount: number;
  snapshotDates: string[];
  observed: {
    latestSnapshotId: string | null;
    latestSnapshotDate: string | null;
    players: PlayerDevelopmentObservedPlayer[];
  };
  manual: {
    trainingPriority: string;
  };
  derived: {
    players: PlayerDevelopmentPlayerSummary[];
  };
  warnings: PlayerDevelopmentWarning[];
}

export interface PlayerDevelopmentObservedPlayer {
  playerId: string | null;
  externalId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  observedPosition: string | null;
  roles: string[];
  skills: SnapshotSkillSet;
}

export interface PlayerDevelopmentPlayerSummary {
  playerId: string | null;
  externalId: string | null;
  name: string;
  age: number;
  role: {
    label: string;
    source: "observed" | "inferred" | "unknown";
  };
  relevantSkills: Array<{
    skill: SkillKey;
    value: number | null;
  }>;
  skillChanges: PlayerSkillChange[];
  recentEvolution: {
    direction: SkillChangeDirection;
    improvedSkills: number;
    declinedSkills: number;
    stableSkills: number;
    comparableSkills: number;
    confidence: Confidence;
  };
  findings: PlayerDevelopmentFinding[];
  signals: PlayerDevelopmentSignal[];
  warnings: PlayerDevelopmentWarning[];
}

export interface PlayerSkillChange {
  skill: SkillKey;
  direction: SkillChangeDirection;
  previousValue: number | null;
  currentValue: number | null;
  delta: number | null;
}

export interface PlayerDevelopmentSignal {
  code: string;
  confidence: Confidence;
  message: string;
  evidence: DevelopmentEvidence[];
}

export interface PlayerDevelopmentFinding {
  type: DevelopmentFindingType;
  severity: Severity;
  confidence: Confidence;
  title: string;
  description: string;
  evidence: DevelopmentEvidence[];
}

export interface PlayerDevelopmentWarning {
  code: string;
  message: string;
  evidence: DevelopmentEvidence[];
}

export interface DevelopmentEvidence {
  kind: "observed" | "manual" | "derived" | "inferred";
  label: string;
  value: string | number | null;
}

export interface ComparablePlayerPoint {
  snapshotId: string;
  snapshotDate: string;
  player: PersistedPlayerSnapshot;
}

export type Severity = "info" | "low" | "medium" | "high";

type EvidenceKind = "observed" | "manual" | "derived" | "inferred";
export type YouthPipelineCategory =
  "standout_prospect" | "follow_up" | "stagnation_risk" | "insufficient_data";
type SkillKey = keyof SnapshotSkillSet;

export interface GetYouthPipelinePlanningInput {
  clubId: string;
}

export interface YouthPipelinePlanning {
  clubId: string;
  snapshotId: string | null;
  snapshotDate: string | null;
  observed: {
    youthAgeThreshold: number;
    players: YouthPipelineObservedPlayer[];
    coverage: {
      seniorPlayerCount: number;
      youngSeniorPlayerCount: number;
      playersWithStableIdentity: number;
      playersWithCompleteSkills: number;
    };
  };
  manual: {
    academyInvestment: string;
  };
  derived: {
    categoryCounts: Record<YouthPipelineCategory, number>;
    players: YouthPipelinePlayerPlan[];
  };
  warnings: YouthPipelineWarning[];
}

export interface YouthPipelineObservedPlayer {
  playerId: string | null;
  externalId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  role: {
    label: string;
    source: "observed" | "inferred" | "unknown";
  };
  wage: { amount: number; currency: string | null };
  estimatedValue: { amount: number; currency: string | null };
  skills: SnapshotSkillSet;
}

export interface YouthPipelinePlayerPlan {
  playerId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  role: {
    label: string;
    source: "observed" | "inferred" | "unknown";
  };
  category: YouthPipelineCategory;
  severity: Severity;
  confidence: Confidence;
  rationale: string;
  context: YouthPipelinePlayerContext;
  signals: YouthPipelineSignal[];
  warnings: YouthPipelineWarning[];
}

export interface YouthPipelinePlayerContext {
  window: {
    from: string | null;
    to: string | null;
    snapshotCount: number;
  };
  dataCompleteness: {
    completeSkills: boolean;
    comparableSkills: number;
  };
  valueAndWage: {
    wage: number;
    wageCurrency: string | null;
    estimatedValue: number;
    estimatedValueCurrency: string | null;
    valueDeltaPercent: number | null;
    wageDeltaPercent: number | null;
  };
  limits: string[];
}

export interface YouthPipelineSignal {
  code: string;
  severity: Severity;
  confidence: Confidence;
  message: string;
  evidence: YouthPipelineEvidence[];
}

export interface YouthPipelineWarning {
  code: string;
  message: string;
  evidence: YouthPipelineEvidence[];
}

export interface YouthPipelineEvidence {
  kind: EvidenceKind;
  label: string;
  value: string | number | null;
}

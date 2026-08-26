import type { Confidence } from "../types.js";
import type { TrainingKind, TalentEstimate } from "../training/types.js";
import type { PlayerTrainingPath, TrainingPathPlayer } from "./training-path-types.js";
import type { DevelopmentProfile, DevelopmentSkill, PlayerDevelopmentTarget } from "./types.js";

export type DevelopmentTrainingKind = Exclude<TrainingKind, "missing">;

export interface DevelopmentTrainingAssumptions {
  trainingKind: DevelopmentTrainingKind;
  expectedIntensity: number;
  assumeContinuousTraining: boolean;
}

export interface DevelopmentCurrentSkillProgress {
  skill: DevelopmentSkill | "defending" | "playmaking" | "scoring";
  estimatedProgress?: number | null;
  remainingToNextLevel?: number | null;
  confidence?: Confidence;
}

export type DevelopmentProjectionWarning =
  | "unknown_current_sublevel"
  | "low_talent_confidence"
  | "long_term_projection"
  | "formation_training_assumed"
  | "advanced_training_assumed"
  | "intensity_assumed"
  | "projection_horizon_exceeded"
  | "invalid_training_points"
  | "path_incomplete"
  | "continuous_training_not_assumed";

export type DevelopmentProjectionStatus = "projected" | "partial" | "unavailable";

export interface DevelopmentProjectionContext {
  player: TrainingPathPlayer;
  target: PlayerDevelopmentTarget;
  path: PlayerTrainingPath;
  currentGameWeek: number;
  currentDate: Date;
  talent?: TalentEstimate | null;
  trainingAssumptions?: DevelopmentTrainingAssumptions;
  currentTrainingProgress?: DevelopmentCurrentSkillProgress;
  birthDate?: Date | null;
  calibrationConfidence?: Confidence;
  maxProjectionWeeks?: number;
}

export interface DevelopmentProjectionStep {
  order: number;
  skill: DevelopmentSkill;
  fromLevel: number;
  toLevel: number;
  estimatedTrainingPoints: number;
  estimatedWeeks: number | null;
  cumulativeWeeks: number | null;
  estimatedGameWeek: number | null;
  estimatedDate: Date | null;
  estimatedAge: number | null;
  confidence: Confidence;
}

export type DevelopmentProjectionMilestoneType =
  "skill_target_completed" | "primary_skills_completed" | "development_target_completed";

export interface DevelopmentProjectionMilestone {
  type: DevelopmentProjectionMilestoneType;
  skill?: DevelopmentSkill;
  step: number;
  cumulativeWeeks: number;
  estimatedGameWeek: number;
  estimatedDate: Date | null;
  estimatedAge: number | null;
  confidence: Confidence;
}

export interface PlayerDevelopmentProjection {
  playerId: number;
  profile: DevelopmentProfile;
  generatedAtGameWeek: number;
  generatedAtDate: Date;
  steps: DevelopmentProjectionStep[];
  milestones: DevelopmentProjectionMilestone[];
  completion: {
    estimatedWeeks: number | null;
    estimatedGameWeek: number | null;
    estimatedDate: Date | null;
    estimatedAge: number | null;
  };
  confidence: Confidence;
  assumptions: DevelopmentTrainingAssumptions;
  projectionStatus: DevelopmentProjectionStatus;
  warnings: DevelopmentProjectionWarning[];
}

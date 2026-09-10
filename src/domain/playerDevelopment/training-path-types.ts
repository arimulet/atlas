import type { Confidence } from "../types.js";
import type {
  DevelopmentPlayer,
  DevelopmentPriority,
  DevelopmentProfile,
  DevelopmentSkill,
  PlayerDevelopmentGap,
  PlayerDevelopmentTarget
} from "./types.js";
import type { TalentEstimate, TrainingHistory } from "../training/types.js";

export interface TrainingPathPlayer extends DevelopmentPlayer {
  age: number;
}

export interface TrainingPathContext {
  player: TrainingPathPlayer;
  target: PlayerDevelopmentTarget;
  developmentGap?: PlayerDevelopmentGap;
  talent?: TalentEstimate | null;
  trainingHistory?: readonly TrainingHistory[];
  expectedWeeklyTrainingPoints?: number;
}

export interface DevelopmentSimulationState {
  skills: Partial<Record<DevelopmentSkill, number>>;
  accumulatedTrainingPoints: number;
  stepsCompleted: number;
  estimatedElapsedWeeks: number;
  estimatedAge: number;
  lastSkill?: DevelopmentSkill;
}

export type TrainingPathReason =
  | {
      type: "primary_target_skill";
      skill: DevelopmentSkill;
    }
  | {
      type: "high_development_return";
      value: number;
    }
  | {
      type: "low_marginal_cost";
      value: number;
    }
  | {
      type: "balances_profile";
      skill: DevelopmentSkill;
    }
  | {
      type: "completes_target_skill";
      skill: DevelopmentSkill;
    };

export interface TrainingPathCandidate {
  skill: DevelopmentSkill;
  fromLevel: number;
  toLevel: number;
  requiredTrainingPoints: number;
  expectedWeeklyTrainingPoints: number;
  estimatedWeeks: number;
  estimatedAgeAtStep: number;
  targetPriority: DevelopmentPriority;
  developmentReturnScore: number;
  developmentValue: number;
  pathScore: number;
  reason: TrainingPathReason[];
}

export interface TrainingPathStep {
  order: number;
  skill: DevelopmentSkill;
  fromLevel: number;
  toLevel: number;
  priority: DevelopmentPriority;
  estimatedTrainingPoints: number;
  developmentValue: number;
  reason: TrainingPathReason[];
}

export type DevelopmentMilestoneType =
  "skill_target_completed" | "primary_skills_completed" | "development_target_completed";

export interface DevelopmentMilestone {
  step: number;
  type: DevelopmentMilestoneType;
  skill?: DevelopmentSkill;
}

export interface PlayerTrainingPath {
  playerId: number;
  profile: DevelopmentProfile;
  steps: TrainingPathStep[];
  milestones: DevelopmentMilestone[];
  totals: {
    skillUps: number;
    estimatedTrainingPoints: number;
  };
  completed: boolean;
  confidence: Confidence;
}

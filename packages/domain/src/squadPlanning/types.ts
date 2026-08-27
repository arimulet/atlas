import type { Confidence, SkillKey } from "../types.js";
import type { TalentEstimate, TrainingKind } from "../training/types.js";
import type {
  DevelopmentProfile,
  DevelopmentPlayer,
  PlayerDevelopmentGap,
  PlayerDevelopmentPlan,
  PlayerDevelopmentProjection,
  PlayerDevelopmentTarget,
  PlayerTrainingPath
} from "../playerDevelopment/index.js";
export type SquadRole = "core" | "developing" | "prospect" | "rotation" | "depth" | "transition";

export type PlayerLifecycleStage = "prospect" | "development" | "prime" | "late_prime" | "decline";

export type SquadRoleReason =
  | { type: "high_current_contribution" }
  | { type: "high_future_potential" }
  | { type: "active_development_plan" }
  | { type: "target_nearly_completed" }
  | { type: "limited_remaining_development" }
  | { type: "late_lifecycle_stage" }
  | { type: "strong_development_projection" }
  | { type: "training_supports_development" }
  | { type: "low_current_contribution" }
  | { type: "relative_current_contribution" }
  | { type: "missing_development_plan" };

export interface SquadRoleAssignment {
  playerId: number;
  role: SquadRole;
  source: "automatic" | "manual";
}

export interface SquadTrainingContext {
  kind: TrainingKind;
  intensity?: number | null;
  skill?: SkillKey | null;
}

export interface SquadPlayerContext extends DevelopmentPlayer {
  playerName?: string;
  age: number | null;
  profile?: DevelopmentProfile | null;
  developmentPlan?: PlayerDevelopmentPlan | null;
  developmentTarget?: PlayerDevelopmentTarget | null;
  developmentGap?: PlayerDevelopmentGap | null;
  trainingPath?: PlayerTrainingPath | null;
  projection?: PlayerDevelopmentProjection | null;
  /** Distinguishes an explicit plan from an inferred target used only for scoring. */
  hasDevelopmentPlan?: boolean;
  talent?: TalentEstimate | null;
  ageFactor?: number | null;
  training?: SquadTrainingContext | null;
  trainingStatus?: TrainingKind | null;
  historyWeeks?: number;
  manualRole?: SquadRoleAssignment | null;
  sokkerValue?: number | null;
  previousAutomaticRole?: SquadRole | null;
}

export interface SquadPlayerAssessment extends SquadRoleAssignment {
  role: SquadRole;
  automaticRole: SquadRole;
  manualRole: SquadRoleAssignment | null;
  lifecycle: PlayerLifecycleStage;
  profile: DevelopmentProfile | null;
  currentContributionScore: number | null;
  futureContributionScore: number | null;
  developmentPotentialScore: number | null;
  currentContributionPercentile: number | null;
  confidence: Confidence;
  reasons: SquadRoleReason[];
}

export interface SquadAssessment {
  players: SquadPlayerAssessment[];
  summary: Record<SquadRole, number>;
}

export interface SquadPlanningConfig {
  coreContributionThreshold: number;
  usefulContributionThreshold: number;
  highFutureContributionThreshold: number;
  corePrimarySkillMinimum: number;
  rotationPrimarySkillMinimum: number;
  coreStaminaMinimum: number;
  rotationStaminaMinimum: number;
  prospectMaximumAge: number;
  prospectPotentialThreshold: number;
  developmentGapThreshold: number;
  transitionDevelopmentThreshold: number;
  roleStabilityMargin: number;
  advancedLifecycleAgeFactor: number;
  declineLifecycleAgeFactor: number;
  advancedLifecycleAge: number;
  declineLifecycleAge: number;
  highClarityMargin: number;
}

export interface SquadContributionMetrics {
  profile: DevelopmentProfile | null;
  currentContributionScore: number | null;
  futureContributionScore: number | null;
  developmentPotentialScore: number | null;
  developmentGap: number | null;
  targetProgress: number | null;
  hasActiveDevelopmentPlan: boolean;
}

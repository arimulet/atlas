import type { Confidence, SkillKey, SkillSet } from "../types.js";
import type {
  DevelopmentMilestoneType,
  PlayerDevelopmentPlan,
  PlayerTrainingPath,
  PlayerDevelopmentProjection
} from "../playerDevelopment/index.js";
import type { TalentEstimate } from "../training/types.js";
import type {
  CalibratedPlayerMarketValueEstimate,
  FindMarketComparablesOptions,
  PlayerTransferRecord
} from "./calibration-types.js";
import type {
  MarketValueRange,
  PlayerMarketValueEstimate,
  PlayerMarketValuePlayerInput
} from "./types.js";

export interface ProjectedPlayerState {
  playerId: number;
  gameWeek: number | null;
  estimatedDate: Date | null;
  estimatedAge: number | null;
  skills: SkillSet;
  completedStep: number;
  milestone?: DevelopmentMilestoneType | null;
}

export type FutureMarketValueReason =
  | { type: "high_value_training_step"; skill: SkillKey }
  | { type: "low_value_training_step"; skill: SkillKey }
  | { type: "diminishing_market_return"; skill: SkillKey }
  | { type: "negative_market_value_return"; skill: SkillKey }
  | { type: "age_discount_offsets_skill_gain" }
  | { type: "advanced_training_value"; value: number }
  | { type: "future_market_segment_low_evidence" }
  | { type: "projected_peak_value" };

export interface FutureMarketValuePoint {
  step: number;
  gameWeek: number | null;
  estimatedDate: Date | null;
  estimatedAge: number | null;
  skills: SkillSet;
  marketValue: MarketValueRange | null;
  valueGainFromCurrent: number | null;
  valueGainFromPrevious: number | null;
  cumulativeTrainingWeeks: number | null;
  confidence: Confidence;
  milestone?: DevelopmentMilestoneType | null;
}

export interface FutureMarketValueMilestone {
  type: DevelopmentMilestoneType;
  step: number;
  gameWeek: number | null;
  age: number | null;
  marketValue: MarketValueRange | null;
  valueGainFromCurrent: number | null;
  confidence: Confidence;
}

export interface FutureMarketValueCompletion {
  estimatedWeeks: number | null;
  estimatedGameWeek: number | null;
  estimatedDate: Date | null;
  estimatedAge: number | null;
  marketValue: MarketValueRange | null;
  valueGain: number | null;
  confidence: Confidence;
}

export interface PeakMarketValuePoint {
  step: number;
  age: number | null;
  value: number;
}

export interface TrainingStepEconomicEvaluation {
  step: number;
  skill: SkillKey;
  estimatedWeeks: number | null;
  marketValueBefore: number | null;
  marketValueAfter: number | null;
  valueGain: number | null;
  valueGainPerWeek: number | null;
  confidence: Confidence;
}

export interface PlayerTrainingRoi {
  /** Market value generated per training time; this is not financial ROI. */
  totalValueGain: number | null;
  totalTrainingWeeks: number | null;
  averageValueGainPerWeek: number | null;
  bestValueStep: {
    step: number;
    skill: SkillKey;
    valueGainPerWeek: number;
  } | null;
  diminishingReturnPoint: {
    step: number;
    skill: SkillKey;
  } | null;
  stepEvaluations: TrainingStepEconomicEvaluation[];
}

export interface FutureMarketValueContext {
  player: PlayerMarketValuePlayerInput;
  developmentPlan: PlayerDevelopmentPlan;
  path: PlayerTrainingPath;
  projection: PlayerDevelopmentProjection;
  currentMarketValue?: CalibratedPlayerMarketValueEstimate | PlayerMarketValueEstimate;
  talent?: TalentEstimate | null;
  transfers?: readonly PlayerTransferRecord[];
  comparableOptions?: FindMarketComparablesOptions;
}

export interface PlayerMarketValueProjection {
  playerId: number;
  current: CalibratedPlayerMarketValueEstimate;
  points: FutureMarketValuePoint[];
  milestones: FutureMarketValueMilestone[];
  completion: FutureMarketValueCompletion | null;
  roi: PlayerTrainingRoi;
  peak: PeakMarketValuePoint | null;
  confidence: Confidence;
  reasons: FutureMarketValueReason[];
  modelVersion: string;
}

export interface TrainingKindMarketValueComparison {
  advanced: PlayerMarketValueProjection;
  formation: PlayerMarketValueProjection;
  difference: {
    completionWeeks: number | null;
    completionValue: number | null;
    valueGeneratedByAdvancedSlot: number | null;
    fixedHorizonWeeks: number | null;
    fixedHorizonAdvancedValue: number | null;
    fixedHorizonFormationValue: number | null;
  };
}

export interface TrainingPathMarketValueComparison {
  first: PlayerMarketValueProjection;
  second: PlayerMarketValueProjection;
  difference: {
    completionWeeks: number | null;
    completionValue: number | null;
    totalValueGain: number | null;
    averageValueGainPerWeek: number | null;
  };
}

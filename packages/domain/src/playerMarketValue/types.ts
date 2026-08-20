import type { Confidence, Money, SkillKey, SkillSet } from "../types.js";
import type { TalentEstimate } from "../training/types.js";
import type {
  DevelopmentProfile,
  DevelopmentPlayer,
  PlayerDevelopmentPlan
} from "../playerDevelopment/index.js";
import type { SquadPlayerAssessment } from "../squadPlanning/types.js";

export interface PlayerMarketValuePlayer extends DevelopmentPlayer {
  age: number | null;
  skills: SkillSet;
  training?: {
    position: number;
  };
  value?: Money | number | null;
  sokkerValue?: number | null;
  profile?: DevelopmentProfile | null;
}

export type PlayerMarketValuePlayerInput = PlayerMarketValuePlayer;

export interface PlayerMarketValueContext {
  player: PlayerMarketValuePlayerInput;
  developmentProfile?: DevelopmentProfile | null;
  squadAssessment?: SquadPlayerAssessment | null;
  developmentPlan?: PlayerDevelopmentPlan | null;
  talent?: TalentEstimate | null;
}

export interface PlayerMarketValueBreakdown {
  skillValue: number;
  ageAdjustment: number;
  profileAdjustment: number;
  skillDistributionAdjustment: number;
  developmentAdjustment: number;
  rawValue: number;
  finalValue: number;
}

export type PlayerMarketValueReason =
  | { type: "elite_primary_skill"; skill: SkillKey; level: number }
  | { type: "strong_skill_distribution" }
  | { type: "young_age_premium" }
  | { type: "age_discount" }
  | { type: "high_development_upside" }
  | { type: "limited_development_upside" }
  | { type: "profile_fallback_used"; profile: DevelopmentProfile }
  | { type: "incomplete_data" }
  | { type: "talent_low_confidence" };

export interface MarketValueRange {
  low: number;
  expected: number;
  high: number;
}

export interface PlayerMarketValueEstimate {
  playerId: number;
  estimatedValue: MarketValueRange;
  /** Alias kept for consumers that use the longer domain wording. */
  estimatedMarketValue: MarketValueRange;
  sokkerValue: number | null;
  marketToSokkerRatio: number | null;
  confidence: Confidence;
  breakdown: PlayerMarketValueBreakdown;
  reasons: PlayerMarketValueReason[];
}

export type PlayerValuation = PlayerMarketValueEstimate;

export interface SquadMarketValueRankingEntry {
  playerId: number;
  expectedValue: number;
  rank: number;
}

export interface SquadMarketValueAssessment {
  players: PlayerMarketValueEstimate[];
  ranking: SquadMarketValueRankingEntry[];
  totalEstimatedValue: number;
  averageEstimatedValue: number;
  medianEstimatedValue: number;
  mostValuablePlayerIds: number[];
}

export interface MarketValueCalibrationSample {
  playerId: number;
  estimatedMarketValue: number;
  sokkerValue: number | null;
  ratio: number | null;
  age: number | null;
  profile: DevelopmentProfile | null;
  primarySkills: Partial<Record<SkillKey, number>>;
}

export interface PlayerMarketValueConfig {
  /** Expected value of a player whose profile skills average the reference level. */
  baseValue: number;
  referenceSkillLevel: number;
  skillExponent: number;
  youngAgeReference: number;
  ageCurveSlope: number;
  minimumAgeFactor: number;
  maximumAgeFactor: number;
  maximumDistributionPremium: number;
  maximumDevelopmentPremium: number;
  rangeSpreadByConfidence: Readonly<Record<Confidence, number>>;
}

import type { Confidence, SkillKey, SkillSet } from "../types.js";
import type { DevelopmentProfile, Formation } from "../playerDevelopment/index.js";
import type {
  MarketValueRange,
  PlayerMarketValueContext,
  PlayerMarketValueEstimate,
  PlayerMarketValuePlayerInput
} from "./types.js";

export type TransferDataSource = "manual" | "imported" | "sokker" | "unknown" | (string & {});
export type TransferDataQuality = "complete" | "partial" | "weak";
export type SalePriceType = "final_sale" | "unknown";

export interface PlayerTransferRecord {
  transferId?: string;
  playerId?: number;
  transferDate: Date;
  gameWeek?: number | null;
  salePrice: number;
  currency?: string | null;
  normalizedSalePrice?: number | null;
  age: number;
  skills: SkillSet;
  formation?: Formation | null;
  developmentProfile?: DevelopmentProfile | null;
  sokkerValue?: number | null;
  source: TransferDataSource;
  dataQuality?: TransferDataQuality;
  salePriceType?: SalePriceType;
}

export interface MarketCurrencyNormalizer {
  normalize(amount: number, currency: string | null | undefined): number | null;
}

export type MarketComparableTarget = PlayerMarketValuePlayerInput | PlayerMarketValueContext;

export type ComparableDifference =
  | { type: "age"; target: number; comparable: number }
  | { type: "skill"; skill: SkillKey; target: number; comparable: number }
  | {
      type: "profile";
      target: DevelopmentProfile | null;
      comparable: DevelopmentProfile | null;
    };

export interface ComparableMarketOutlier {
  transferId?: string;
  price: number;
  reason: "robust_price_deviation";
}

export interface MarketComparable {
  transfer: PlayerTransferRecord;
  similarityScore: number;
  recencyWeight: number;
  dataQualityWeight: number;
  adjustedSimilarityScore: number;
  normalizedSalePrice: number;
  adjustedSalePrice: number;
  differences: ComparableDifference[];
  outlier?: ComparableMarketOutlier;
}

export interface ComparablePriceDispersion {
  coefficient: number | null;
  low: number;
  high: number;
  median: number | null;
}

export interface FindMarketComparablesOptions {
  asOfDate?: Date;
  beforeDateExclusive?: Date;
  maxComparables?: number;
  minimumSimilarity?: number;
  baseCurrency?: string | null;
  currencyNormalizer?: MarketCurrencyNormalizer;
  currencyRates?: Readonly<Record<string, number>>;
  calibrationConfig?: Partial<MarketCalibrationConfig>;
  excludeTransferId?: string;
  excludePlayerId?: number;
}

export interface ComparableMarketEstimate {
  comparables: MarketComparable[];
  estimatedValue: MarketValueRange | null;
  weightedAverage: number | null;
  weightedMedian: number | null;
  sampleSize: number;
  confidence: Confidence;
  outliers: ComparableMarketOutlier[];
  priceDispersion: ComparablePriceDispersion;
}

export interface MarketCalibrationFactor {
  expected: number;
  low: number;
  high: number;
  sampleSize: number;
  confidence: Confidence;
}

export interface MarketCalibrationConfig {
  maxComparables: number;
  minimumSimilarity: number;
  recencyHalfLifeDays: number;
  minimumSamplesForMediumConfidence: number;
  minimumSamplesForHighConfidence: number;
  maximumWeakEvidenceAdjustment: number;
  maximumCalibrationAdjustment: number;
  maximumComparablePriceAdjustment: number;
  completeDataQualityWeight: number;
  partialDataQualityWeight: number;
  weakDataQualityWeight: number;
  rangeSpreadByConfidence: Readonly<Record<Confidence, number>>;
  baseCurrency: string | null;
  currencyRates: Readonly<Record<string, number>>;
  outlierMadMultiplier: number;
  outlierRelativeTolerance: number;
}

export interface CalibratedPlayerMarketValueEstimate {
  playerId: number;
  fundamental: PlayerMarketValueEstimate;
  comparableEstimate: ComparableMarketEstimate | null;
  calibrationFactor: MarketCalibrationFactor | null;
  calibratedValue: MarketValueRange;
  confidence: Confidence;
  calibrationStrength: number;
  reasons: PlayerMarketValueEstimate["reasons"];
}

export interface MarketValueBacktestSample {
  transferId?: string;
  playerId?: number;
  transferDate: Date;
  age: number;
  profile: DevelopmentProfile | null;
  actualSalePrice: number;
  fundamentalPredictedValue: number;
  predictedValue: number;
  absoluteError: number;
  percentageError: number | null;
  comparableCount: number;
  confidence: Confidence;
  primarySkillLevel: number | null;
}

export interface MarketValueBacktestSummary {
  samples: number;
  meanAbsoluteError: number | null;
  medianAbsoluteError: number | null;
  meanAbsolutePercentageError: number | null;
  medianAbsolutePercentageError: number | null;
  within10Percent: number;
  within25Percent: number;
  within50Percent: number;
  overvaluedSamples: number;
  undervaluedSamples: number;
}

export interface MarketModelComparison {
  fundamental: MarketValueBacktestSummary;
  calibrated: MarketValueBacktestSummary;
  improvement: {
    absoluteErrorReduction: number | null;
    percentageErrorReduction: number | null;
    calibratedImproved: boolean | null;
  };
}

export interface MarketValueBacktestResult {
  samples: MarketValueBacktestSample[];
  fundamental: MarketValueBacktestSummary;
  calibrated: MarketValueBacktestSummary;
  comparison: MarketModelComparison;
}

export type MarketValueBiasDirection = "overvalue" | "undervalue" | "balanced";

export interface MarketValueBiasSegment {
  dimension: "age_band" | "profile" | "fundamental_value_band" | "primary_skill_band";
  key: string;
  sampleSize: number;
  medianError: number;
  direction: MarketValueBiasDirection;
}

export interface MarketValueBiasReport {
  segments: MarketValueBiasSegment[];
}

export interface PlayerTransferRepository {
  save(transfer: PlayerTransferRecord): Promise<PlayerTransferRecord>;
  findTransfersForCalibration(input?: {
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<PlayerTransferRecord[]>;
  findTransfersBefore(date: Date): Promise<PlayerTransferRecord[]>;
}

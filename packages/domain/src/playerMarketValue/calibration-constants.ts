import type { MarketCalibrationConfig } from "./calibration-types.js";

export const MARKET_CALIBRATION_CONFIG: MarketCalibrationConfig = {
  maxComparables: 8,
  minimumSimilarity: 0.55,
  recencyHalfLifeDays: 180,
  minimumSamplesForMediumConfidence: 3,
  minimumSamplesForHighConfidence: 5,
  maximumWeakEvidenceAdjustment: 0.1,
  maximumCalibrationAdjustment: 0.35,
  maximumComparablePriceAdjustment: 0.35,
  completeDataQualityWeight: 1,
  partialDataQualityWeight: 0.72,
  weakDataQualityWeight: 0.4,
  rangeSpreadByConfidence: {
    low: 0.35,
    medium: 0.22,
    high: 0.12
  },
  baseCurrency: null,
  currencyRates: {},
  outlierMadMultiplier: 3,
  outlierRelativeTolerance: 0.35
};

export const MAX_MARKET_COMPARABLES = MARKET_CALIBRATION_CONFIG.maxComparables;
export const MIN_COMPARABLE_SIMILARITY = MARKET_CALIBRATION_CONFIG.minimumSimilarity;

import type { PlayerMarketValueConfig } from "./types.js";

/**
 * V1 deliberately keeps all monetary scale and uncertainty assumptions in one place.
 * These values are calibration parameters, not a claim about Sokker auction prices.
 */
export const PLAYER_MARKET_VALUE_CONFIG: PlayerMarketValueConfig = {
  baseValue: 850_000,
  referenceSkillLevel: 10,
  skillExponent: 1.9,
  youngAgeReference: 24,
  ageCurveSlope: 0.055,
  minimumAgeFactor: 0.58,
  maximumAgeFactor: 1.45,
  maximumDistributionPremium: 0.08,
  maximumDevelopmentPremium: 0.1,
  rangeSpreadByConfidence: {
    low: 0.35,
    medium: 0.2,
    high: 0.1
  }
};

export const MARKET_VALUE_CONFIG = PLAYER_MARKET_VALUE_CONFIG;

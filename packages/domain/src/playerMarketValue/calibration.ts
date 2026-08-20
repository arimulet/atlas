import {
  estimateComparableMarketValue,
  findMarketComparables,
  playerFromTransferRecord
} from "./comparables.js";
import { DEVELOPMENT_PROFILES } from "../playerDevelopment/index.js";
import type { Confidence, SkillKey } from "../types.js";
import { MARKET_CALIBRATION_CONFIG } from "./calibration-constants.js";
import type {
  ComparableMarketEstimate,
  FindMarketComparablesOptions,
  MarketCalibrationConfig,
  MarketCalibrationFactor,
  MarketValueBiasDirection,
  MarketValueBiasReport,
  MarketValueBiasSegment,
  MarketValueBacktestResult,
  MarketValueBacktestSample,
  MarketValueBacktestSummary,
  MarketModelComparison,
  MarketComparable,
  MarketComparableTarget,
  PlayerTransferRecord
} from "./calibration-types.js";
import type {
  MarketValueRange,
  PlayerMarketValueContext,
  PlayerMarketValueEstimate,
  PlayerMarketValueReason,
  PlayerMarketValueConfig
} from "./types.js";
import { estimatePlayerMarketValue } from "./index.js";

export function calculateMarketCalibrationFactor(
  target: MarketComparableTarget,
  comparableEstimate: ComparableMarketEstimate,
  fundamentalConfig?: PlayerMarketValueConfig,
  config: MarketCalibrationConfig = MARKET_CALIBRATION_CONFIG
): MarketCalibrationFactor | null {
  void target;
  if (comparableEstimate.sampleSize === 0) return null;
  const ratios = comparableEstimate.comparables
    .map((comparable) => {
      const fundamental = estimateTransferFundamental(comparable.transfer, fundamentalConfig);
      const salePrice = comparable.normalizedSalePrice;
      return fundamental.estimatedValue.expected > 0
        ? {
            ratio: salePrice / fundamental.estimatedValue.expected,
            weight: comparable.adjustedSimilarityScore
          }
        : null;
    })
    .filter(
      (item): item is { ratio: number; weight: number } =>
        item !== null && Number.isFinite(item.ratio)
    );
  if (ratios.length === 0) return null;

  const usableRatios = removeRatioOutliers(ratios, config);
  const expected = weightedMedianRatio(usableRatios);
  const dispersion = ratioDispersion(usableRatios);
  const confidence = calibrationFactorConfidence(comparableEstimate, dispersion, config);
  const spread = clamp(
    config.rangeSpreadByConfidence[confidence] + Math.min(dispersion, 0.5) * 0.2,
    0.1,
    0.55
  );

  return {
    expected: roundFactor(expected),
    low: Math.max(0, roundFactor(expected * (1 - spread))),
    high: Math.max(0, roundFactor(expected * (1 + spread))),
    sampleSize: ratios.length,
    confidence
  };
}

export function calibratePlayerMarketValue(
  input: PlayerMarketValueContext | import("./types.js").PlayerMarketValuePlayerInput,
  transfers: readonly PlayerTransferRecord[],
  options: FindMarketComparablesOptions = {},
  fundamentalConfig?: PlayerMarketValueConfig,
  config: MarketCalibrationConfig = MARKET_CALIBRATION_CONFIG
): import("./calibration-types.js").CalibratedPlayerMarketValueEstimate {
  const context = "player" in input ? input : { player: input };
  const fundamental = estimatePlayerMarketValue(context, fundamentalConfig);
  const comparableOptions: FindMarketComparablesOptions = {
    ...options,
    calibrationConfig: config
  };
  const comparableEstimateValue = estimateComparableMarketValue(
    context,
    transfers,
    comparableOptions,
    fundamentalConfig
  );
  const comparableEstimate =
    comparableEstimateValue.sampleSize > 0 ? comparableEstimateValue : null;
  const calibrationFactor = comparableEstimate
    ? calculateMarketCalibrationFactor(context, comparableEstimate, fundamentalConfig, config)
    : null;
  const calibrationStrength = comparableEstimate
    ? calculateCalibrationStrength(comparableEstimate, config)
    : 0;
  const rawAdjustment = calibrationFactor ? calibrationFactor.expected - 1 : 0;
  const maximumAllowedAdjustment =
    comparableEstimate && comparableEstimate.sampleSize < 3
      ? config.maximumWeakEvidenceAdjustment
      : config.maximumCalibrationAdjustment;
  const boundedAdjustment = clamp(
    rawAdjustment * calibrationStrength,
    -maximumAllowedAdjustment,
    maximumAllowedAdjustment
  );
  const calibratedExpected = roundNumber(
    fundamental.estimatedValue.expected * (1 + boundedAdjustment)
  );
  const confidence = calculateCalibratedConfidence(
    fundamental,
    comparableEstimate,
    calibrationFactor,
    config
  );
  const calibratedValue = createCalibratedRange(calibratedExpected, confidence, config);
  const reasons: PlayerMarketValueReason[] = [...fundamental.reasons];

  if (!comparableEstimate || !calibrationFactor) {
    reasons.push({ type: "no_comparable_market_evidence" });
  } else {
    reasons.push({ type: "comparable_market_evidence", sampleSize: comparableEstimate.sampleSize });
    if (calibrationFactor.expected > 1.05) {
      reasons.push({ type: "market_premium", factor: calibrationFactor.expected });
    } else if (calibrationFactor.expected < 0.95) {
      reasons.push({ type: "market_discount", factor: calibrationFactor.expected });
    }
    if ((comparableEstimate.priceDispersion.coefficient ?? 0) > 0.5) {
      reasons.push({ type: "high_price_dispersion" });
    }
  }

  return {
    playerId: context.player.playerId,
    fundamental,
    comparableEstimate,
    calibrationFactor,
    calibratedValue,
    confidence,
    calibrationStrength,
    reasons
  };
}

export function runMarketValueBacktest(
  transfers: readonly PlayerTransferRecord[],
  fundamentalConfig?: PlayerMarketValueConfig,
  config: MarketCalibrationConfig = MARKET_CALIBRATION_CONFIG
): MarketValueBacktestResult {
  const samples = transfers
    .filter((transfer) => Number.isFinite(transfer.salePrice) && transfer.salePrice > 0)
    .filter(
      (transfer) =>
        transfer.transferDate instanceof Date && Number.isFinite(transfer.transferDate.getTime())
    )
    .sort(compareTransfers)
    .map((transfer): MarketValueBacktestSample => {
      const target = { player: playerFromTransferRecord(transfer) };
      const fundamental = estimatePlayerMarketValue(target, fundamentalConfig);
      const calibrated = calibratePlayerMarketValue(
        target,
        transfers,
        {
          beforeDateExclusive: transfer.transferDate,
          excludeTransferId: transfer.transferId
        },
        fundamentalConfig,
        config
      );
      const actualSalePrice = transfer.normalizedSalePrice ?? transfer.salePrice;
      const predictedValue = calibrated.calibratedValue.expected;
      const primarySkillLevel = readPrimarySkillLevel(transfer);
      return {
        ...(transfer.transferId ? { transferId: transfer.transferId } : {}),
        ...(transfer.playerId === undefined ? {} : { playerId: transfer.playerId }),
        transferDate: transfer.transferDate,
        age: transfer.age,
        profile: transfer.developmentProfile ?? null,
        actualSalePrice,
        fundamentalPredictedValue: fundamental.estimatedValue.expected,
        predictedValue,
        absoluteError: Math.abs(predictedValue - actualSalePrice),
        percentageError:
          actualSalePrice > 0 ? Math.abs(predictedValue - actualSalePrice) / actualSalePrice : null,
        comparableCount: calibrated.comparableEstimate?.sampleSize ?? 0,
        confidence: calibrated.confidence,
        primarySkillLevel
      };
    });
  const fundamental = summarizeBacktest(samples, (sample) => sample.fundamentalPredictedValue);
  const calibrated = summarizeBacktest(samples, (sample) => sample.predictedValue);
  const comparison: MarketModelComparison = {
    fundamental,
    calibrated,
    improvement: {
      absoluteErrorReduction: calculateReduction(
        fundamental.meanAbsoluteError,
        calibrated.meanAbsoluteError
      ),
      percentageErrorReduction: calculateReduction(
        fundamental.meanAbsolutePercentageError,
        calibrated.meanAbsolutePercentageError
      ),
      calibratedImproved:
        fundamental.meanAbsoluteError === null || calibrated.meanAbsoluteError === null
          ? null
          : calibrated.meanAbsoluteError < fundamental.meanAbsoluteError
    }
  };

  return { samples, fundamental, calibrated, comparison };
}

export function buildMarketValueBiasReport(
  samples: readonly MarketValueBacktestSample[]
): MarketValueBiasReport {
  const groups = new Map<string, MarketValueBacktestSample[]>();
  for (const sample of samples) {
    addBiasGroup(groups, "age_band", ageBand(sample.age), sample);
    addBiasGroup(groups, "profile", sample.profile ?? "unknown", sample);
    addBiasGroup(
      groups,
      "fundamental_value_band",
      valueBand(sample.fundamentalPredictedValue),
      sample
    );
    addBiasGroup(groups, "primary_skill_band", skillBand(sample.primarySkillLevel), sample);
  }
  const segments = [...groups.entries()]
    .map(([groupKey, group]) => {
      const [dimension, key] = groupKey.split("|") as [MarketValueBiasSegment["dimension"], string];
      const errors = group
        .filter((sample) => sample.actualSalePrice > 0)
        .map((sample) => (sample.predictedValue - sample.actualSalePrice) / sample.actualSalePrice);
      const medianError = median(errors);
      return {
        dimension,
        key,
        sampleSize: group.length,
        medianError,
        direction: biasDirection(medianError)
      } satisfies MarketValueBiasSegment;
    })
    .sort(
      (left, right) =>
        left.dimension.localeCompare(right.dimension) || left.key.localeCompare(right.key)
    );
  return { segments };
}

export function calculateCalibrationStrength(
  comparableEstimate: ComparableMarketEstimate,
  config: MarketCalibrationConfig = MARKET_CALIBRATION_CONFIG
): number {
  if (comparableEstimate.sampleSize === 0) return 0;
  const comparables = comparableEstimate.comparables;
  const averageSimilarity = weightedMetric(comparables, (item) => item.similarityScore);
  const averageRecency = weightedMetric(comparables, (item) => item.recencyWeight);
  const averageQuality = weightedMetric(comparables, (item) => item.dataQualityWeight);
  const sampleEvidence = clamp(comparables.length / config.minimumSamplesForHighConfidence, 0, 1);
  const dispersionPenalty =
    1 - clamp((comparableEstimate.priceDispersion.coefficient ?? 1) * 0.7, 0, 0.7);
  const evidence =
    sampleEvidence * averageSimilarity * averageRecency * averageQuality * dispersionPenalty;
  const maxStrength = comparables.length < 3 ? config.maximumWeakEvidenceAdjustment : 0.7;
  return clamp(evidence * maxStrength, 0, maxStrength);
}

export class PlayerMarketCalibrationService {
  constructor(
    private readonly config: MarketCalibrationConfig = MARKET_CALIBRATION_CONFIG,
    private readonly fundamentalConfig?: PlayerMarketValueConfig
  ) {}

  findMarketComparables(
    target: MarketComparableTarget,
    transfers: readonly PlayerTransferRecord[],
    options: FindMarketComparablesOptions = {}
  ): MarketComparable[] {
    return findMarketComparables(target, transfers, {
      ...options,
      calibrationConfig: this.config
    });
  }

  estimateComparableMarketValue(
    target: MarketComparableTarget,
    transfers: readonly PlayerTransferRecord[],
    options: FindMarketComparablesOptions = {}
  ): ComparableMarketEstimate {
    return estimateComparableMarketValue(
      target,
      transfers,
      { ...options, calibrationConfig: this.config },
      this.fundamentalConfig
    );
  }

  calibrate(
    input: PlayerMarketValueContext | import("./types.js").PlayerMarketValuePlayerInput,
    transfers: readonly PlayerTransferRecord[],
    options: FindMarketComparablesOptions = {}
  ): import("./calibration-types.js").CalibratedPlayerMarketValueEstimate {
    return calibratePlayerMarketValue(
      input,
      transfers,
      options,
      this.fundamentalConfig,
      this.config
    );
  }

  calibratePlayerMarketValue(
    input: PlayerMarketValueContext | import("./types.js").PlayerMarketValuePlayerInput,
    transfers: readonly PlayerTransferRecord[],
    options: FindMarketComparablesOptions = {}
  ): import("./calibration-types.js").CalibratedPlayerMarketValueEstimate {
    return this.calibrate(input, transfers, options);
  }

  backtest(transfers: readonly PlayerTransferRecord[]): MarketValueBacktestResult {
    return runMarketValueBacktest(transfers, this.fundamentalConfig, this.config);
  }
}

function calculateCalibratedConfidence(
  fundamental: PlayerMarketValueEstimate,
  comparable: ComparableMarketEstimate | null,
  factor: MarketCalibrationFactor | null,
  config: MarketCalibrationConfig
): Confidence {
  if (!comparable || !factor) return "low";
  if (
    comparable.confidence === "high" &&
    factor.confidence === "high" &&
    Math.abs(factor.expected - 1) <= 0.25 &&
    fundamental.confidence !== "low"
  ) {
    return "high";
  }
  if (
    comparable.confidence !== "low" &&
    factor.sampleSize >= config.minimumSamplesForMediumConfidence
  ) {
    return "medium";
  }
  return "low";
}

function createCalibratedRange(
  expected: number,
  confidence: Confidence,
  config: MarketCalibrationConfig
): MarketValueRange {
  const spread = config.rangeSpreadByConfidence[confidence];
  return {
    low: Math.max(0, roundNumber(expected * (1 - spread))),
    expected: Math.max(0, roundNumber(expected)),
    high: Math.max(0, roundNumber(expected * (1 + spread)))
  };
}

function estimateTransferFundamental(
  transfer: PlayerTransferRecord,
  fundamentalConfig?: PlayerMarketValueConfig
): PlayerMarketValueEstimate {
  return estimatePlayerMarketValue(
    { player: playerFromTransferRecord(transfer) },
    fundamentalConfig
  );
}

function removeRatioOutliers(
  ratios: readonly { ratio: number; weight: number }[],
  config: MarketCalibrationConfig
): { ratio: number; weight: number }[] {
  if (ratios.length < 4) return [...ratios];
  const center = median(ratios.map((item) => item.ratio));
  const mad = median(ratios.map((item) => Math.abs(item.ratio - center)));
  const tolerance = Math.max(
    mad * config.outlierMadMultiplier,
    Math.max(center, 1) * config.outlierRelativeTolerance
  );
  const filtered = ratios.filter((item) => Math.abs(item.ratio - center) <= tolerance);
  return filtered.length > 0 ? filtered : [...ratios];
}

function weightedMedianRatio(ratios: readonly { ratio: number; weight: number }[]): number {
  const sorted = [...ratios].sort((left, right) => left.ratio - right.ratio);
  const totalWeight = sorted.reduce((total, item) => total + item.weight, 0);
  let accumulated = 0;
  for (const item of sorted) {
    accumulated += item.weight;
    if (accumulated >= totalWeight / 2) return item.ratio;
  }
  return sorted.at(-1)?.ratio ?? 1;
}

function ratioDispersion(ratios: readonly { ratio: number }[]): number {
  if (ratios.length < 2) return 0.5;
  const center = median(ratios.map((item) => item.ratio));
  return center > 0
    ? Math.sqrt(
        ratios.reduce((total, item) => total + Math.pow(item.ratio - center, 2), 0) / ratios.length
      ) / center
    : 1;
}

function calibrationFactorConfidence(
  comparable: ComparableMarketEstimate,
  dispersion: number,
  config: MarketCalibrationConfig
): Confidence {
  if (comparable.confidence === "high" && dispersion <= 0.25) return "high";
  if (comparable.sampleSize >= config.minimumSamplesForMediumConfidence && dispersion <= 0.55)
    return "medium";
  return "low";
}

function summarizeBacktest(
  samples: readonly MarketValueBacktestSample[],
  predictor: (sample: MarketValueBacktestSample) => number
): MarketValueBacktestSummary {
  if (samples.length === 0) {
    return {
      samples: 0,
      meanAbsoluteError: null,
      medianAbsoluteError: null,
      meanAbsolutePercentageError: null,
      medianAbsolutePercentageError: null,
      within10Percent: 0,
      within25Percent: 0,
      within50Percent: 0,
      overvaluedSamples: 0,
      undervaluedSamples: 0
    };
  }
  const absoluteErrors = samples.map((sample) =>
    Math.abs(predictor(sample) - sample.actualSalePrice)
  );
  const percentageErrors = samples
    .filter((sample) => sample.actualSalePrice > 0)
    .map((sample) => Math.abs(predictor(sample) - sample.actualSalePrice) / sample.actualSalePrice);
  return {
    samples: samples.length,
    meanAbsoluteError: average(absoluteErrors),
    medianAbsoluteError: median(absoluteErrors),
    meanAbsolutePercentageError: average(percentageErrors),
    medianAbsolutePercentageError: median(percentageErrors),
    within10Percent: percentageErrors.filter((error) => error <= 0.1).length,
    within25Percent: percentageErrors.filter((error) => error <= 0.25).length,
    within50Percent: percentageErrors.filter((error) => error <= 0.5).length,
    overvaluedSamples: samples.filter((sample) => predictor(sample) > sample.actualSalePrice)
      .length,
    undervaluedSamples: samples.filter((sample) => predictor(sample) < sample.actualSalePrice)
      .length
  };
}

function readPrimarySkillLevel(transfer: PlayerTransferRecord): number | null {
  const profile = transfer.developmentProfile ?? null;
  const primary = profile
    ? DEVELOPMENT_PROFILES[profile].relevantSkills.filter((item) => item.priority === "primary")
    : [];
  const levels = primary
    .map((item) => transfer.skills[item.skill as SkillKey])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return levels.length > 0 ? average(levels) : null;
}

function addBiasGroup(
  groups: Map<string, MarketValueBacktestSample[]>,
  dimension: MarketValueBiasSegment["dimension"],
  key: string,
  sample: MarketValueBacktestSample
): void {
  const groupKey = `${dimension}|${key}`;
  groups.set(groupKey, [...(groups.get(groupKey) ?? []), sample]);
}

function biasDirection(error: number): MarketValueBiasDirection {
  if (error > 0.05) return "overvalue";
  if (error < -0.05) return "undervalue";
  return "balanced";
}

function ageBand(age: number): string {
  if (age <= 17) return "15-17";
  if (age <= 20) return "18-20";
  if (age <= 24) return "21-24";
  if (age <= 29) return "25-29";
  return "30+";
}

function valueBand(value: number): string {
  if (value < 500_000) return "<500k";
  if (value < 1_000_000) return "500k-1M";
  if (value < 2_000_000) return "1M-2M";
  return "2M+";
}

function skillBand(value: number | null): string {
  if (value === null) return "unknown";
  if (value < 8) return "<8";
  if (value < 12) return "8-11";
  if (value < 15) return "12-14";
  return "15+";
}

function calculateReduction(before: number | null, after: number | null): number | null {
  if (before === null || after === null || before === 0) return null;
  return (before - after) / before;
}

function weightedMetric(
  comparables: readonly MarketComparable[],
  metric: (item: MarketComparable) => number
): number {
  const totalWeight = comparables.reduce((total, item) => total + item.adjustedSimilarityScore, 0);
  return totalWeight > 0
    ? comparables.reduce((total, item) => total + metric(item) * item.adjustedSimilarityScore, 0) /
        totalWeight
    : 0;
}

function compareTransfers(left: PlayerTransferRecord, right: PlayerTransferRecord): number {
  return (
    left.transferDate.getTime() - right.transferDate.getTime() ||
    (left.transferId ?? "").localeCompare(right.transferId ?? "")
  );
}

function average(values: readonly number[]): number | null {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function roundNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function roundFactor(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Number(value.toFixed(4))) : 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

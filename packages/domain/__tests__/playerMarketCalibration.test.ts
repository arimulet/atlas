import { describe, expect, it } from "vitest";

import {
  buildMarketValueBiasReport,
  calculateComparableAgeSimilarity,
  calculateMarketCalibrationFactor,
  calculatePlayerMarketSimilarity,
  calculateTransferRecencyWeight,
  calibratePlayerMarketValue,
  deduplicateTransferRecords,
  estimateComparableMarketValue,
  findMarketComparables,
  MARKET_CALIBRATION_CONFIG,
  runMarketValueBacktest,
  type MarketValueBacktestSample,
  type PlayerMarketValuePlayer,
  type PlayerTransferRecord
} from "@atlas/domain";

function player(overrides: Partial<PlayerMarketValuePlayer> = {}): PlayerMarketValuePlayer {
  return {
    playerId: 1,
    age: 20,
    formation: "DEF",
    profile: "central_defender",
    skills: {
      pace: 12,
      technique: 10,
      passing: 8,
      keeper: 1,
      defender: 13,
      playmaker: 9,
      striker: 3
    },
    ...overrides
  };
}

function transfer(overrides: Partial<PlayerTransferRecord> = {}): PlayerTransferRecord {
  return {
    transferId: "t-1",
    playerId: 100,
    transferDate: new Date("2026-08-01T00:00:00.000Z"),
    salePrice: 2_000_000,
    currency: "ARS",
    age: 20,
    skills: player().skills,
    formation: "DEF",
    developmentProfile: "central_defender",
    source: "manual",
    ...overrides
  };
}

describe("Player Market comparable calibration", () => {
  it("gives an identical player maximum similarity", () => {
    const similarity = calculatePlayerMarketSimilarity(player(), transfer());

    expect(similarity).toBe(1);
  });

  it("weights primary skill differences more than irrelevant skill differences", () => {
    const primaryDifference = calculatePlayerMarketSimilarity(
      player(),
      transfer({ skills: { ...player().skills, defender: 8 } })
    );
    const irrelevantDifference = calculatePlayerMarketSimilarity(
      player(),
      transfer({ skills: { ...player().skills, striker: 18 } })
    );

    expect(1 - primaryDifference).toBeGreaterThan(1 - irrelevantDifference);
  });

  it("makes high-level skill differences more significant", () => {
    const low = calculatePlayerMarketSimilarity(
      player({ skills: { ...player().skills, defender: 7 } }),
      transfer({ skills: { ...player().skills, defender: 5 } })
    );
    const elite = calculatePlayerMarketSimilarity(
      player({ skills: { ...player().skills, defender: 15 } }),
      transfer({ skills: { ...player().skills, defender: 13 } })
    );

    expect(1 - elite).toBeGreaterThan(1 - low);
  });

  it("uses progressive age similarity and penalizes a large age gap", () => {
    expect(calculateComparableAgeSimilarity(20, 20)).toBe(1);
    expect(calculateComparableAgeSimilarity(20, 21)).toBeGreaterThan(
      calculateComparableAgeSimilarity(20, 25)
    );
  });

  it("prefers the same profile and supports formation fallback", () => {
    const same = calculatePlayerMarketSimilarity(player(), transfer());
    const different = calculatePlayerMarketSimilarity(
      player(),
      transfer({ developmentProfile: "forward", formation: "ATT" })
    );
    const formationFallback = calculatePlayerMarketSimilarity(
      player({ profile: null }),
      transfer({ developmentProfile: null, formation: "DEF" })
    );

    expect(same).toBeGreaterThan(different);
    expect(formationFallback).toBeGreaterThan(0.5);
  });

  it("applies recency through a smooth half-life", () => {
    const asOf = new Date("2026-08-01T00:00:00.000Z");
    const recent = calculateTransferRecencyWeight(new Date("2026-07-01T00:00:00.000Z"), asOf);
    const old = calculateTransferRecencyWeight(new Date("2026-02-01T00:00:00.000Z"), asOf);

    expect(recent).toBeGreaterThan(old);
    expect(calculateTransferRecencyWeight(new Date("2026-02-02T00:00:00.000Z"), asOf)).toBeCloseTo(
      old,
      2
    );
  });

  it("applies data quality to comparable weight", () => {
    const complete = findMarketComparables(player(), [transfer({ transferId: "complete" })]);
    const partial = findMarketComparables(player(), [
      transfer({
        transferId: "partial",
        dataQuality: "partial",
        skills: { defender: 13, pace: 12 }
      })
    ]);

    expect(complete[0]?.dataQualityWeight).toBeGreaterThan(partial[0]?.dataQualityWeight ?? 1);
  });

  it("filters weak similarity and respects the maximum comparable count", () => {
    const transfers = Array.from({ length: 12 }, (_, index) =>
      transfer({ transferId: `good-${index}`, transferDate: new Date(2026, 0, index + 1) })
    );
    transfers.push(
      transfer({
        transferId: "irrelevant",
        formation: "ATT",
        developmentProfile: "forward",
        skills: { striker: 15, pace: 15, technique: 14 },
        age: 35
      })
    );

    const comparables = findMarketComparables(player(), transfers, {
      maxComparables: 5,
      minimumSimilarity: 0.7
    });

    expect(comparables).toHaveLength(5);
    expect(comparables.every((item) => item.similarityScore >= 0.7)).toBe(true);
    expect(comparables.some((item) => item.transfer.transferId === "irrelevant")).toBe(false);
  });

  it("uses weighted median and records price outliers", () => {
    const transfers = [2_200_000, 2_400_000, 2_500_000, 2_600_000, 8_900_000].map(
      (salePrice, index) => transfer({ transferId: `price-${index}`, salePrice })
    );

    const estimate = estimateComparableMarketValue(player(), transfers);

    expect(estimate.weightedMedian).toBeLessThan(3_000_000);
    expect(estimate.outliers).toHaveLength(1);
    expect(estimate.outliers[0]?.price).toBe(8_900_000);
    expect(estimate.estimatedValue?.expected).toBeLessThan(3_000_000);
  });

  it("adjusts a comparable price through the fundamental target/comparable ratio", () => {
    const comparable = estimateComparableMarketValue(
      player({ age: 19, skills: { ...player().skills, defender: 12 } }),
      [transfer({ age: 22, skills: { ...player().skills, defender: 11 }, salePrice: 2_000_000 })]
    );

    expect(comparable.comparables[0]?.adjustedSalePrice).toBeGreaterThan(0);
    expect(comparable.comparables[0]?.adjustedSalePrice).not.toBe(2_000_000);
  });

  it("derives a market multiplier from normalized comparable sales", () => {
    const estimate = estimateComparableMarketValue(player(), [
      transfer({ transferId: "one", salePrice: 2_000_000 }),
      transfer({ transferId: "two", salePrice: 2_100_000 }),
      transfer({ transferId: "three", salePrice: 2_050_000 })
    ]);
    const factor = calculateMarketCalibrationFactor(player(), estimate);

    expect(factor?.expected).toBeGreaterThan(0);
    expect(factor?.sampleSize).toBe(3);
  });

  it("returns fundamental value with low confidence when there are no comparables", () => {
    const calibrated = calibratePlayerMarketValue(player(), []);

    expect(calibrated.comparableEstimate).toBeNull();
    expect(calibrated.calibrationFactor).toBeNull();
    expect(calibrated.calibratedValue.expected).toBe(
      calibrated.fundamental.estimatedValue.expected
    );
    expect(calibrated.confidence).toBe("low");
  });

  it("limits weak evidence adjustment", () => {
    const calibrated = calibratePlayerMarketValue(player(), [transfer({ salePrice: 20_000_000 })]);
    const fundamental = calibrated.fundamental.estimatedValue.expected;

    expect(
      Math.abs(calibrated.calibratedValue.expected - fundamental) / fundamental
    ).toBeLessThanOrEqual(MARKET_CALIBRATION_CONFIG.maximumWeakEvidenceAdjustment + 0.01);
  });

  it("increases calibration strength with several strong comparables", () => {
    const weak = calibratePlayerMarketValue(player(), [transfer()]);
    const strong = calibratePlayerMarketValue(
      player(),
      Array.from({ length: 6 }, (_, index) =>
        transfer({
          transferId: `strong-${index}`,
          transferDate: new Date(2026, 7, index + 1),
          salePrice: 2_000_000 + index * 10_000
        })
      )
    );

    expect(strong.calibrationStrength).toBeGreaterThan(weak.calibrationStrength);
  });

  it("reduces confidence when comparable prices disperse", () => {
    const estimate = estimateComparableMarketValue(player(), [
      transfer({ transferId: "a", salePrice: 1_000_000 }),
      transfer({ transferId: "b", salePrice: 2_000_000 }),
      transfer({ transferId: "c", salePrice: 5_000_000 })
    ]);

    expect(estimate.priceDispersion.coefficient).toBeGreaterThan(0);
    expect(estimate.confidence).not.toBe("high");
  });

  it("can reach high confidence with enough strong, recent and consistent sales", () => {
    const transfers = Array.from({ length: 6 }, (_, index) =>
      transfer({
        transferId: `high-${index}`,
        transferDate: new Date(2026, 7, index + 1),
        salePrice: 1_500_000 + index * 5_000
      })
    );
    const calibrated = calibratePlayerMarketValue(player(), transfers);

    expect(calibrated.comparableEstimate?.confidence).toBe("high");
    expect(calibrated.confidence).toBe("high");
  });

  it("backtests without using the target transfer or future transfers", () => {
    const first = transfer({
      transferId: "first",
      transferDate: new Date("2026-01-01"),
      salePrice: 1_000_000
    });
    const target = transfer({
      transferId: "target",
      transferDate: new Date("2026-02-01"),
      salePrice: 2_000_000
    });
    const future = transfer({
      transferId: "future",
      transferDate: new Date("2026-03-01"),
      salePrice: 9_000_000
    });
    const result = runMarketValueBacktest([first, target, future]);
    const targetSample = result.samples.find((sample) => sample.transferId === "target");

    expect(targetSample?.comparableCount).toBe(1);
    expect(targetSample?.actualSalePrice).toBe(2_000_000);
    expect(result.samples.find((sample) => sample.transferId === "first")?.comparableCount).toBe(0);
  });

  it("computes absolute and percentage errors and compares models", () => {
    const samples: MarketValueBacktestSample[] = [
      {
        transferId: "sample",
        transferDate: new Date("2026-01-01"),
        age: 20,
        profile: "central_defender",
        actualSalePrice: 100,
        fundamentalPredictedValue: 80,
        predictedValue: 110,
        absoluteError: 10,
        percentageError: 0.1,
        comparableCount: 2,
        confidence: "medium",
        primarySkillLevel: 13
      }
    ];
    const result = runMarketValueBacktest([]);
    const bias = buildMarketValueBiasReport(samples);

    expect(result.comparison.improvement.calibratedImproved).toBeNull();
    expect(bias.segments.some((segment) => segment.direction === "overvalue")).toBe(true);
  });

  it("deduplicates by stable transfer id and player/date key", () => {
    const duplicates = deduplicateTransferRecords([
      transfer({ transferId: "same", dataQuality: "weak", salePrice: 1_000_000 }),
      transfer({ transferId: "same", dataQuality: "complete", salePrice: 2_000_000 }),
      transfer({ transferId: undefined, salePrice: 3_000_000 }),
      transfer({ transferId: undefined, salePrice: 3_000_000 })
    ]);

    expect(duplicates).toHaveLength(2);
    expect(duplicates.find((item) => item.transferId === "same")?.salePrice).toBe(2_000_000);
  });

  it("normalizes compatible currencies and rejects unknown conversions", () => {
    const normalized = findMarketComparables(
      player(),
      [transfer({ currency: "USD", salePrice: 2 })],
      {
        baseCurrency: "ARS",
        currencyRates: { USD: 1_000_000 }
      }
    );
    const rejected = findMarketComparables(
      player(),
      [transfer({ currency: "EUR", salePrice: 2 })],
      {
        baseCurrency: "ARS"
      }
    );

    expect(normalized[0]?.normalizedSalePrice).toBe(2_000_000);
    expect(rejected).toHaveLength(0);
  });

  it("keeps all calibrated ranges valid and finite", () => {
    const calibrated = calibratePlayerMarketValue(player(), [transfer()]);

    expect(Number.isFinite(calibrated.calibratedValue.expected)).toBe(true);
    expect(calibrated.calibratedValue.low).toBeLessThanOrEqual(calibrated.calibratedValue.expected);
    expect(calibrated.calibratedValue.expected).toBeLessThanOrEqual(
      calibrated.calibratedValue.high
    );
  });
});

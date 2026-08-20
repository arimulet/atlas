import { describe, expect, it } from "vitest";

import {
  estimatePlayerMarketValue,
  type CalibratedPlayerMarketValueEstimate,
  type ComparableMarketEstimate,
  type MarketComparable,
  type PlayerMarketValuePlayer,
  type PlayerMarketValueProjection,
  type SquadDepthPlayer,
  type TrainingKindMarketValueComparison
} from "@atlas/domain";
import {
  createPlayerMarketValueViewModel,
  createSquadMarketValueSummary
} from "./market-value-view-model";

const basePlayer: PlayerMarketValuePlayer = {
  playerId: 7,
  age: 18,
  formation: "DEF",
  profile: "central_defender",
  sokkerValue: 1_300_000,
  skills: {
    stamina: 8,
    pace: 12,
    technique: 10,
    passing: 8,
    keeper: 1,
    defender: 13,
    playmaker: 9,
    striker: 3
  }
};

function marketValue(overrides: Partial<CalibratedPlayerMarketValueEstimate> = {}) {
  const fundamental = estimatePlayerMarketValue({ player: basePlayer });
  return {
    playerId: basePlayer.playerId,
    fundamental,
    comparableEstimate: null,
    calibrationFactor: null,
    calibratedValue: { low: 2_000_000, expected: 2_400_000, high: 2_900_000 },
    confidence: "medium" as const,
    calibrationStrength: 0,
    reasons: fundamental.reasons,
    ...overrides
  } satisfies CalibratedPlayerMarketValueEstimate;
}

function depthPlayer(overrides: Partial<SquadDepthPlayer> = {}): SquadDepthPlayer {
  return {
    playerId: basePlayer.playerId,
    playerName: "Player One",
    role: "developing",
    automaticRole: "developing",
    source: "automatic",
    manualRole: null,
    lifecycle: "development",
    profile: "central_defender",
    currentContributionScore: 0.5,
    futureContributionScore: 0.8,
    developmentPotentialScore: 0.7,
    currentContributionPercentile: 0.5,
    confidence: "medium",
    reasons: [],
    marketValue: marketValue(),
    marketProjection: null,
    ...overrides
  };
}

function comparable(index: number, outlier = false): MarketComparable {
  return {
    transfer: {
      transferId: `transfer-${index}`,
      transferDate: new Date(`2026-08-${String(index + 1).padStart(2, "0")}`),
      salePrice: outlier ? 8_000_000 : 2_400_000 + index * 100_000,
      age: 18 + (index % 2),
      skills: basePlayer.skills,
      formation: "DEF",
      developmentProfile: "central_defender",
      source: "manual"
    },
    similarityScore: outlier ? 0.86 : 0.9,
    recencyWeight: 0.9,
    dataQualityWeight: 1,
    adjustedSimilarityScore: 0.81,
    normalizedSalePrice: outlier ? 8_000_000 : 2_400_000 + index * 100_000,
    adjustedSalePrice: outlier ? 8_000_000 : 2_400_000 + index * 100_000,
    differences: [
      { type: "age", target: 18, comparable: 19 },
      { type: "skill", skill: "pace", target: 12, comparable: 11 }
    ],
    ...(outlier ? { outlier: { price: 8_000_000, reason: "robust_price_deviation" as const } } : {})
  };
}

function comparableEstimate(): ComparableMarketEstimate {
  const comparables = Array.from({ length: 6 }, (_, index) => comparable(index, index === 5));
  return {
    comparables,
    estimatedValue: { low: 2_300_000, expected: 2_650_000, high: 2_950_000 },
    weightedAverage: 2_600_000,
    weightedMedian: 2_550_000,
    sampleSize: comparables.length,
    confidence: "medium",
    outliers: [{ transferId: "transfer-5", price: 8_000_000, reason: "robust_price_deviation" }],
    priceDispersion: { coefficient: 0.2, low: 2_400_000, high: 8_000_000, median: 2_650_000 }
  };
}

function projection(): PlayerMarketValueProjection {
  return {
    playerId: basePlayer.playerId,
    current: marketValue(),
    points: [
      {
        step: 1,
        gameWeek: 10,
        estimatedDate: null,
        estimatedAge: 18.2,
        skills: basePlayer.skills,
        marketValue: { low: 2_400_000, expected: 2_900_000, high: 3_300_000 },
        valueGainFromCurrent: 500_000,
        valueGainFromPrevious: 500_000,
        cumulativeTrainingWeeks: 2,
        confidence: "medium",
        milestone: null
      }
    ],
    milestones: [],
    completion: {
      estimatedWeeks: 20,
      estimatedGameWeek: 30,
      estimatedDate: null,
      estimatedAge: 19,
      marketValue: { low: 4_500_000, expected: 5_000_000, high: 5_700_000 },
      valueGain: 2_600_000,
      confidence: "low"
    },
    roi: {
      totalValueGain: 2_600_000,
      totalTrainingWeeks: 20,
      averageValueGainPerWeek: 130_000,
      bestValueStep: { step: 1, skill: "defender", valueGainPerWeek: 250_000 },
      diminishingReturnPoint: { step: 2, skill: "pace" },
      stepEvaluations: [
        {
          step: 1,
          skill: "defender",
          estimatedWeeks: 2,
          marketValueBefore: 2_400_000,
          marketValueAfter: 2_900_000,
          valueGain: 500_000,
          valueGainPerWeek: 250_000,
          confidence: "medium"
        },
        {
          step: 2,
          skill: "pace",
          estimatedWeeks: 8,
          marketValueBefore: 2_900_000,
          marketValueAfter: 2_800_000,
          valueGain: -100_000,
          valueGainPerWeek: -12_500,
          confidence: "low"
        }
      ]
    },
    peak: { step: 1, age: 18.2, value: 2_900_000 },
    confidence: "low",
    reasons: [
      { type: "diminishing_market_return", skill: "pace" },
      { type: "negative_market_value_return", skill: "pace" }
    ],
    modelVersion: "test"
  };
}

function trainingComparison(): TrainingKindMarketValueComparison {
  const current = projection();
  return {
    advanced: current,
    formation: current,
    difference: {
      completionWeeks: 5,
      completionValue: 600_000,
      valueGeneratedByAdvancedSlot: 400_000,
      fixedHorizonWeeks: 12,
      fixedHorizonAdvancedValue: 3_500_000,
      fixedHorizonFormationValue: 3_100_000
    }
  };
}

describe("market value presentation models", () => {
  it("keeps Sokker Value separate from calibrated ATLAS value and exposes the range", () => {
    const viewModel = createPlayerMarketValueViewModel(depthPlayer(), "ARS");

    expect(viewModel?.current.expected.value).toBe(2_400_000);
    expect(viewModel?.current.range.label).toContain("2,000,000");
    expect(viewModel?.current.sokkerValue?.value).toBe(1_300_000);
    expect(viewModel?.current.fundamental.value).not.toBe(viewModel?.current.calibrated.value);
  });

  it("marks fundamental-only valuation and does not invent evidence", () => {
    const viewModel = createPlayerMarketValueViewModel(depthPlayer(), "ARS");

    expect(viewModel?.current.basedOnFundamentalOnly).toBe(true);
    expect(viewModel?.evidence.sampleSize).toBe(0);
    expect(viewModel?.evidence.comparables).toEqual([]);
  });

  it("truncates comparable list and reports excluded outliers", () => {
    const viewModel = createPlayerMarketValueViewModel(
      depthPlayer({
        marketValue: marketValue({
          comparableEstimate: comparableEstimate(),
          reasons: [{ type: "comparable_market_evidence", sampleSize: 6 }]
        })
      }),
      "ARS"
    );

    expect(viewModel?.evidence.sampleSize).toBe(6);
    expect(viewModel?.evidence.comparables).toHaveLength(5);
    expect(viewModel?.evidence.outliersExcluded).toBe(1);
    expect(viewModel?.evidence.strongMatches).toBe(6);
  });

  it("maps semantic reasons instead of exposing internal codes", () => {
    const viewModel = createPlayerMarketValueViewModel(
      depthPlayer({
        marketValue: marketValue({
          comparableEstimate: comparableEstimate(),
          reasons: [{ type: "comparable_market_evidence", sampleSize: 6 }]
        })
      }),
      "ARS"
    );

    expect(viewModel?.reasons.some((reason) => reason.includes("comparable sales"))).toBe(true);
    expect(viewModel?.reasons.some((reason) => reason.includes("no_comparable"))).toBe(false);
  });

  it("exposes projection, target completion, peak and confidence decay", () => {
    const viewModel = createPlayerMarketValueViewModel(
      depthPlayer({ marketProjection: projection() }),
      "ARS"
    );

    expect(viewModel?.projection?.nextSkillUp?.value.value).toBe(2_900_000);
    expect(viewModel?.projection?.targetCompletion?.value.value).toBe(5_000_000);
    expect(viewModel?.projection?.peak?.value.value).toBe(2_900_000);
    expect(viewModel?.projection?.targetCompletion?.confidence.level).toBe("low");
  });

  it("exposes training efficiency, diminishing and negative returns", () => {
    const viewModel = createPlayerMarketValueViewModel(
      depthPlayer({ marketProjection: projection() }),
      "ARS"
    );

    expect(viewModel?.training?.averageValueGainPerWeek?.value).toBe(130_000);
    expect(viewModel?.training?.diminishingReturn).toContain("decline");
    expect(viewModel?.training?.negativeReturn).toBe(true);
  });

  it("exposes advanced slot impact separately", () => {
    const viewModel = createPlayerMarketValueViewModel(
      depthPlayer({
        marketProjection: projection(),
        marketTrainingComparison: trainingComparison()
      }),
      "ARS"
    );

    expect(viewModel?.advancedImpact?.horizonWeeks).toBe(12);
    expect(viewModel?.advancedImpact?.advancedSlotValue?.value).toBe(400_000);
  });

  it("builds squad current/projected totals, coverage and top assets", () => {
    const summary = createSquadMarketValueSummary(
      [
        depthPlayer(),
        depthPlayer({ playerId: 8, playerName: "Player Two", marketProjection: projection() }),
        depthPlayer({ playerId: 9, playerName: "Unknown", marketValue: null })
      ],
      "ARS"
    );

    expect(summary.coverage).toEqual({ valued: 2, total: 3, comparableBacked: 0 });
    expect(summary.currentTotal.value).toBe(4_800_000);
    expect(summary.projectedTotal.value).toBe(7_400_000);
    expect(summary.potentialValueCreation.value).toBe(2_600_000);
    expect(summary.topAssets[0]?.name).toBe("Player One");
  });

  it("returns null for a missing valuation rather than zero", () => {
    expect(createPlayerMarketValueViewModel(depthPlayer({ marketValue: null }), "ARS")).toBeNull();
    expect(
      createSquadMarketValueSummary([depthPlayer({ marketValue: null })], "ARS").currentTotal.label
    ).toBe("—");
  });
});

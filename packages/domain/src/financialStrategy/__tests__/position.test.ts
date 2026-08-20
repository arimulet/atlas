import { describe, expect, it } from "vitest";
import type {
  PlayerMarketValueEstimate,
  PlayerMarketValueProjection,
  SquadMarketValueAssessment
} from "../../playerMarketValue/index.js";
import {
  assessClubFinancialPosition,
  buildClubFinancialPosition,
  type FinancialPositionContext
} from "../index.js";

function marketEstimate(
  playerId: number,
  expected: number,
  confidence: "low" | "medium" | "high" = "high"
): PlayerMarketValueEstimate {
  const range = { low: expected * 0.8, expected, high: expected * 1.2 };
  return {
    playerId,
    estimatedValue: range,
    estimatedMarketValue: range,
    sokkerValue: null,
    marketToSokkerRatio: null,
    confidence,
    breakdown: {
      skillValue: expected,
      ageAdjustment: 0,
      profileAdjustment: 0,
      skillDistributionAdjustment: 0,
      developmentAdjustment: 0,
      rawValue: expected,
      finalValue: expected
    },
    reasons: []
  };
}

function squadMarketValue(players: PlayerMarketValueEstimate[]): SquadMarketValueAssessment {
  const ranking = [...players]
    .sort(
      (left, right) =>
        right.estimatedValue.expected - left.estimatedValue.expected ||
        left.playerId - right.playerId
    )
    .map((player, index) => ({
      playerId: player.playerId,
      expectedValue: player.estimatedValue.expected,
      rank: index + 1
    }));
  const total = players.reduce((sum, player) => sum + player.estimatedValue.expected, 0);
  return {
    players,
    ranking,
    totalEstimatedValue: total,
    averageEstimatedValue: players.length > 0 ? total / players.length : 0,
    medianEstimatedValue: players[0]?.estimatedValue.expected ?? 0,
    mostValuablePlayerIds: ranking[0] ? [ranking[0].playerId] : []
  };
}

function baseContext(overrides: Partial<FinancialPositionContext> = {}): FinancialPositionContext {
  const players = [
    { playerId: 1, wage: 100_000, squadRole: "core" as const },
    { playerId: 2, wage: 80_000, squadRole: "developing" as const },
    { playerId: 3, wage: 60_000, squadRole: "prospect" as const }
  ];
  const squadMarket = squadMarketValue([
    marketEstimate(1, 12_000_000),
    marketEstimate(2, 8_000_000),
    marketEstimate(3, 5_000_000)
  ]);
  return {
    club: { budget: 10_000_000, currency: "ARS" },
    players,
    trainers: [
      { trainerId: 10, salary: 40_000, info: { salary: 999_999 }, active: true, contracted: true },
      { trainerId: 11, salary: 20_000, active: true, contracted: true }
    ],
    squadMarketValue: squadMarket,
    squadPlayerCount: 3,
    ...overrides
  };
}

describe("financial strategy position", () => {
  it("uses observed club budget and separates liquid from estimated sporting capital", () => {
    const assessment = assessClubFinancialPosition(baseContext());

    expect(assessment.position.cash).toBe(10_000_000);
    expect(assessment.position.knownCapital).toEqual({
      expected: 35_000_000,
      liquid: 10_000_000,
      illiquid: 25_000_000
    });
    expect(assessment.position.provenance.cash).toBe("observed");
  });

  it("calculates player, trainer and total known payroll without double counting trainer info", () => {
    const position = buildClubFinancialPosition(baseContext());

    expect(position.knownPayroll.playersWeekly).toBe(240_000);
    expect(position.knownPayroll.trainersWeekly).toBe(60_000);
    expect(position.knownPayroll.totalWeekly).toBe(300_000);
    expect(position.knownPayroll.composition).toEqual({ playerShare: 0.8, trainerShare: 0.2 });
  });

  it("derives safety ratios without Infinity", () => {
    const position = buildClubFinancialPosition(baseContext());

    expect(position.metrics.payrollCoverageWeeks).toBeCloseTo(33.3333);
    expect(position.metrics.cashToSquadValueRatio).toBe(0.4);
    expect(position.metrics.liquidityRatio).toBeCloseTo(10 / 35);
    expect(position.metrics.payrollToCashRatio).toBeCloseTo(0.03);
    expect(JSON.stringify(position)).not.toMatch(/Infinity|NaN/);

    const zeroPayroll = buildClubFinancialPosition(baseContext({ players: [], trainers: [] }));
    expect(zeroPayroll.metrics.payrollCoverageWeeks).toBeNull();
    expect(zeroPayroll.metrics.payrollToCashRatio).toBe(0);
  });

  it("reuses squad market value, exposes coverage and concentration", () => {
    const position = buildClubFinancialPosition(baseContext({ squadPlayerCount: 4 }));

    expect(position.squadAssetValue.expected).toBe(25_000_000);
    expect(position.squadAssetValue.coverage).toBe(0.75);
    expect(position.squadAssetValue.concentration?.top1Share).toBeCloseTo(12 / 25);
    expect(position.squadAssetValue.concentration?.top3Share).toBe(1);
    expect(position.warnings).toContainEqual({
      type: "incomplete_market_value_coverage",
      coverage: 0.75
    });
  });

  it("derives role-based asset distribution when Squad Planning is available", () => {
    const context = baseContext({
      squadAssessment: {
        players: [
          {
            playerId: 1,
            role: "core",
            source: "automatic",
            automaticRole: "core",
            manualRole: null,
            lifecycle: "prime",
            profile: null,
            currentContributionScore: null,
            futureContributionScore: null,
            developmentPotentialScore: null,
            currentContributionPercentile: null,
            confidence: "high",
            reasons: []
          },
          {
            playerId: 2,
            role: "developing",
            source: "automatic",
            automaticRole: "developing",
            manualRole: null,
            lifecycle: "prospect",
            profile: null,
            currentContributionScore: null,
            futureContributionScore: null,
            developmentPotentialScore: null,
            currentContributionPercentile: null,
            confidence: "high",
            reasons: []
          },
          {
            playerId: 3,
            role: "prospect",
            source: "automatic",
            automaticRole: "prospect",
            manualRole: null,
            lifecycle: "prospect",
            profile: null,
            currentContributionScore: null,
            futureContributionScore: null,
            developmentPotentialScore: null,
            currentContributionPercentile: null,
            confidence: "high",
            reasons: []
          }
        ],
        summary: { core: 1, developing: 1, prospect: 1, rotation: 0, depth: 0, transition: 0 }
      }
    });
    const position = buildClubFinancialPosition(context);

    expect(position.squadAssetValue.distribution).toEqual({
      core: 12_000_000,
      developing: 8_000_000,
      prospect: 5_000_000,
      rotation: 0,
      depth: 0,
      transition: 0
    });
  });

  it("derives development capital only from covered projections", () => {
    const projection = {
      playerId: 1,
      current: { calibratedValue: { low: 1, expected: 2, high: 3 }, confidence: "high" },
      completion: { marketValue: { low: 4, expected: 5, high: 6 } },
      confidence: "high"
    } as PlayerMarketValueProjection;
    const assessment = assessClubFinancialPosition(
      baseContext({ marketProjections: [projection], squadPlayerCount: 3 })
    );

    expect(assessment.developmentCapital).toMatchObject({
      currentValue: 2,
      projectedTargetValue: 5,
      projectedValueCreation: 3,
      playersCovered: 1,
      projectionCoverage: 1 / 3
    });
    expect(assessment.warnings).toContainEqual({
      type: "incomplete_projection_coverage",
      coverage: 1 / 3
    });
  });

  it("classifies strong, healthy, watch, strained and unknown positions from combined evidence", () => {
    const strong = buildClubFinancialPosition(
      baseContext({ club: { budget: 100_000_000, currency: "ARS" } })
    );
    expect(strong.status).toBe("strong");

    const healthy = buildClubFinancialPosition(
      baseContext({ club: { budget: 10_000_000, currency: "ARS" }, squadPlayerCount: 3 })
    );
    expect(healthy.status).toBe("healthy");

    const watch = buildClubFinancialPosition(
      baseContext({ club: { budget: 4_000_000, currency: "ARS" } })
    );
    expect(watch.status).toBe("watch");

    const strained = buildClubFinancialPosition(
      baseContext({ club: { budget: 500_000, currency: "ARS" } })
    );
    expect(strained.status).toBe("strained");

    const unknown = buildClubFinancialPosition(
      baseContext({
        club: { budget: null, currency: "ARS" },
        players: [],
        trainers: [],
        squadMarketValue: null
      })
    );
    expect(unknown.status).toBe("unknown");
  });

  it("calculates observed cash trend without inferring causality", () => {
    const assessment = assessClubFinancialPosition(
      baseContext({
        historicalSnapshots: [
          { gameWeek: 10, budget: 13_000_000 },
          { gameWeek: 11, budget: 11_000_000 }
        ]
      })
    );

    expect(assessment.trends.cash).toEqual({
      current: 11_000_000,
      previous: 13_000_000,
      change: -2_000_000,
      changePercent: -2 / 13
    });
  });

  it("is deterministic and never creates transfer or budget recommendations", () => {
    const context = baseContext();
    const first = assessClubFinancialPosition(context);
    const second = assessClubFinancialPosition(context);

    expect(first).toEqual(second);
    expect(first).not.toHaveProperty("transferRecommendation");
    expect(first).not.toHaveProperty("transferBudget");
  });
});

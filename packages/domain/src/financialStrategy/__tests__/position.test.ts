import { describe, expect, it } from "vitest";
import type {
  PlayerMarketValueEstimate,
  PlayerMarketValueProjection,
  SquadMarketValueAssessment
} from "../../playerMarketValue/index.js";
import {
  assessInvestmentSafety,
  assessClubFinancialPosition,
  buildCapitalAllocationPlan,
  buildClubFinancialPosition,
  calculateFinancialReserve,
  calculateInvestmentCapacity,
  calculateSpendableCash,
  estimateStrategicCapitalNeeds,
  simulateFinancialPositionAfterCashCommitment,
  type CapitalAllocationContext,
  type FinancialPositionContext
} from "../index.js";
import type { SquadDepthAnalysis, SquadDepthPlayer } from "../../squadPlanning/index.js";

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

function depthPlayer(
  playerId: number,
  role: SquadDepthPlayer["role"],
  profile: SquadDepthPlayer["profile"] = "goalkeeper"
): SquadDepthPlayer {
  return {
    playerId,
    role,
    source: "automatic",
    automaticRole: role,
    manualRole: null,
    lifecycle: "prospect",
    profile,
    currentContributionScore: null,
    futureContributionScore: null,
    developmentPotentialScore: null,
    currentContributionPercentile: null,
    confidence: "high",
    reasons: []
  };
}

function depthAnalysis(
  profile: SquadDepthPlayer["profile"] = "goalkeeper",
  playerIds: number[] = [1]
): SquadDepthAnalysis {
  return {
    profiles: [
      {
        profile: profile!,
        requirement: { profile: profile!, minimum: 1, ideal: 2 },
        current: {
          availablePlayers: playerIds.length,
          strongOptions: 0,
          developingOptions: 0,
          prospects: playerIds.length,
          playerIds,
          depthScore: 0.4
        },
        nextSeason: {
          availablePlayers: playerIds.length,
          strongOptions: 0,
          developingOptions: 0,
          prospects: playerIds.length,
          playerIds,
          depthScore: 0.4
        },
        mediumTerm: {
          availablePlayers: playerIds.length,
          strongOptions: 0,
          developingOptions: 0,
          prospects: playerIds.length,
          playerIds,
          depthScore: 0.4
        },
        succession: {
          successionRequired: true,
          outgoingPlayers: [],
          successorCandidates: [],
          coverageStatus: "missing"
        },
        status: "thin",
        confidence: "high",
        dependencyRisk: null,
        reasons: []
      }
    ],
    summary: {
      criticalProfiles: 0,
      thinProfiles: 1,
      balancedProfiles: 0,
      deepProfiles: 0,
      overstockedProfiles: 0,
      missingSuccessions: 1,
      dependencyRisks: 0
    }
  };
}

function recommendation(
  id: string,
  type: "find_external" | "prepare_successor" | "accelerate_development",
  priority: "critical" | "high" | "medium",
  horizon: "current" | "next_season" | "medium_term",
  profile: SquadDepthPlayer["profile"] = "goalkeeper"
): CapitalAllocationContext["squadPlanning"]["recommendations"][number] {
  return {
    id,
    type,
    profile: profile!,
    priority,
    horizon,
    playerIds: [],
    confidence: "high",
    reasons: [],
    candidates: []
  };
}

function allocationContext(
  financialAssessment: ReturnType<typeof assessClubFinancialPosition>,
  recommendations: ReturnType<typeof recommendation>[],
  options: Partial<
    Pick<CapitalAllocationContext, "squadPlayers" | "playerMarketValues" | "playerProfiles">
  > = {}
): CapitalAllocationContext {
  return {
    financialAssessment,
    squadPlanning: {
      recommendations,
      conflicts: [],
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        profilesNeedingExternalHelp: 0,
        profilesWithInternalSolutions: 0,
        profilesOverstocked: 0
      }
    },
    depthAnalysis: depthAnalysis("goalkeeper", [1]),
    ...options
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

  it("protects a known-payroll reserve and never exposes negative spendable cash", () => {
    const financialAssessment = assessClubFinancialPosition(baseContext());
    const reserve = calculateFinancialReserve(financialAssessment.position);
    const spendable = calculateSpendableCash(financialAssessment.position.cash, reserve);

    expect(reserve.reserveBasis.knownPayrollWeeks).toBe(10);
    expect(reserve.reserveBasis.amountFromPayroll).toBe(3_000_000);
    expect(reserve.minimumCashReserve).toBe(3_000_000);
    expect(spendable.availableCash).toBe(7_000_000);

    const lowCash = assessClubFinancialPosition(
      baseContext({ club: { budget: 100_000, currency: "ARS" } })
    );
    const lowCashReserve = calculateFinancialReserve(lowCash.position);
    expect(calculateSpendableCash(lowCash.position.cash, lowCashReserve).availableCash).toBe(0);
  });

  it("derives conservative and maximum capacity from status-specific configured utilization", () => {
    const financialAssessment = assessClubFinancialPosition(baseContext());
    const reserve = calculateFinancialReserve(financialAssessment.position);
    const spendable = calculateSpendableCash(financialAssessment.position.cash, reserve);
    const capacity = calculateInvestmentCapacity(financialAssessment.position, spendable);

    expect(capacity.immediate).toBe(7_000_000);
    expect(capacity.conservative).toBe(3_850_000);
    expect(capacity.maximumRecommended).toBe(5_250_000);

    const strained = assessClubFinancialPosition(
      baseContext({ club: { budget: 500_000, currency: "ARS" } })
    );
    const strainedReserve = calculateFinancialReserve(strained.position);
    const strainedCapacity = calculateInvestmentCapacity(
      strained.position,
      calculateSpendableCash(strained.position.cash, strainedReserve)
    );
    expect(strainedCapacity.conservative).toBe(0);
    expect(strainedCapacity.maximumRecommended).toBe(0);
  });

  it("simulates a cash commitment immutably and recalculates payroll coverage and liquidity", () => {
    const financialAssessment = assessClubFinancialPosition(baseContext());
    const simulated = simulateFinancialPositionAfterCashCommitment(financialAssessment, 1_000_000);

    expect(simulated.cash).toBe(9_000_000);
    expect(simulated.metrics.payrollCoverageWeeks).toBe(30);
    expect(simulated.metrics.liquidityRatio).toBeCloseTo(9 / 34);
    expect(financialAssessment.position.cash).toBe(10_000_000);
  });

  it("classifies safe, acceptable, aggressive and unsafe investments", () => {
    const financialAssessment = assessClubFinancialPosition(baseContext());

    expect(assessInvestmentSafety(financialAssessment, 1_000_000).safety).toBe("safe");
    expect(assessInvestmentSafety(financialAssessment, 4_000_000).safety).toBe("acceptable");
    expect(assessInvestmentSafety(financialAssessment, 6_000_000).safety).toBe("aggressive");
    expect(assessInvestmentSafety(financialAssessment, 8_000_000).safety).toBe("unsafe");
  });

  it("turns external squad recommendations into capital needs using market value references", () => {
    const financialAssessment = assessClubFinancialPosition(
      baseContext({ club: { budget: 100_000_000, currency: "ARS" } })
    );
    const context = allocationContext(
      financialAssessment,
      [recommendation("gk-need", "find_external", "critical", "next_season")],
      {
        playerMarketValues: [marketEstimate(1, 5_000_000), marketEstimate(2, 7_000_000)],
        playerProfiles: [
          { playerId: 1, profile: "goalkeeper" },
          { playerId: 2, profile: "goalkeeper" }
        ]
      }
    );
    const needs = estimateStrategicCapitalNeeds(context);

    expect(needs).toHaveLength(1);
    expect(needs[0]).toMatchObject({
      type: "external_recruitment",
      profile: "goalkeeper",
      confidence: "high"
    });
    expect(needs[0]?.estimatedCapitalRequirement).toEqual({
      low: 4_000_000,
      expected: 7_000_000,
      high: 8_400_000
    });
  });

  it("does not invent cash requirements for development support", () => {
    const financialAssessment = assessClubFinancialPosition(baseContext());
    const context = allocationContext(financialAssessment, [
      recommendation("accel", "accelerate_development", "high", "current")
    ]);
    const plan = buildCapitalAllocationPlan(context);

    expect(plan.strategicNeeds[0]).toMatchObject({
      type: "development_support",
      estimatedCapitalRequirement: null
    });
    expect(plan.allocation[0]?.coverage).toBe("not_cash_dependent");
    expect(plan.allocation[0]?.allocatedAmount).toBe(0);
  });

  it("allocates near-term needs by priority and leaves medium-term capacity uncommitted", () => {
    const financialAssessment = assessClubFinancialPosition(
      baseContext({ club: { budget: 100_000_000, currency: "ARS" } })
    );
    const context = allocationContext(
      financialAssessment,
      [
        recommendation("medium", "find_external", "high", "medium_term"),
        recommendation("urgent", "find_external", "critical", "current")
      ],
      {
        playerMarketValues: [marketEstimate(1, 1_000_000)],
        playerProfiles: [{ playerId: 1, profile: "goalkeeper" }]
      }
    );
    const plan = buildCapitalAllocationPlan(context);

    expect(plan.strategicNeeds.map((need) => need.sourceRecommendationId)).toEqual([
      "urgent",
      "medium"
    ]);
    expect(
      plan.allocation.find((item) => item.strategicNeedId === "capital:urgent")?.coverage
    ).toBe("fully_funded");
    expect(plan.allocation.find((item) => item.strategicNeedId === "capital:medium")?.timing).toBe(
      "medium_term"
    );
    expect(
      plan.allocation.find((item) => item.strategicNeedId === "capital:medium")?.allocatedAmount
    ).toBe(0);
  });

  it("reports partial funding and a deterministic funding gap", () => {
    const financialAssessment = assessClubFinancialPosition(baseContext());
    const context = allocationContext(
      financialAssessment,
      [recommendation("expensive", "find_external", "critical", "current")],
      {
        playerMarketValues: [marketEstimate(1, 5_000_000)],
        playerProfiles: [{ playerId: 1, profile: "goalkeeper" }]
      }
    );
    const plan = buildCapitalAllocationPlan(context);

    expect(plan.allocation[0]?.coverage).toBe("partially_funded");
    expect(plan.fundingGaps[0]).toMatchObject({
      strategicNeedId: "capital:expensive",
      allocated: 3_850_000,
      gap: 1_150_000
    });
    expect(plan.unallocatedCapacity).toBe(0);
  });

  it("keeps potential asset liquidity separate from cash-backed capacity", () => {
    const financialAssessment = assessClubFinancialPosition(baseContext());
    const context = allocationContext(financialAssessment, [], {
      playerMarketValues: [marketEstimate(1, 5_000_000), marketEstimate(2, 4_000_000)],
      squadPlayers: [depthPlayer(1, "core"), depthPlayer(2, "transition")]
    });
    const plan = buildCapitalAllocationPlan(context);

    expect(plan.monetizableAssets.find((asset) => asset.playerId === 1)?.liquidityPotential).toBe(
      "low"
    );
    expect(plan.monetizableAssets.find((asset) => asset.playerId === 2)?.liquidityPotential).toBe(
      "high"
    );
    expect(plan.potentialAssetLiquidity).toBe(4_000_000);
    expect(plan.extendedCapacity.cashBacked).toBe(plan.investmentCapacity.maximumRecommended);
    expect(plan.extendedCapacity.theoreticalMaximum).toBe(
      (plan.investmentCapacity.maximumRecommended ?? 0) + 4_000_000
    );
  });

  it("degrades confidence and capacity safely when financial evidence is unknown", () => {
    const financialAssessment = assessClubFinancialPosition(
      baseContext({
        club: { budget: null, currency: "ARS" },
        players: [],
        trainers: [],
        squadMarketValue: null
      })
    );
    const plan = buildCapitalAllocationPlan(allocationContext(financialAssessment, []));

    expect(plan.status).toBe("unknown");
    expect(plan.confidence).toBe("low");
    expect(plan.spendableCash.availableCash).toBeNull();
    expect(plan.investmentCapacity.maximumRecommended).toBeNull();
    expect(JSON.stringify(plan)).not.toMatch(/Infinity|NaN/);
  });
});

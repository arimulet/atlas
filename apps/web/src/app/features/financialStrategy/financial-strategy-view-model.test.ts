import { describe, expect, it } from "vitest";
import type {
  CapitalAllocationPlan,
  ClubFinancialAssessment,
  FinancialStrategyPlan,
  InvestmentSafetyAssessment
} from "@atlas/domain";
import type { FinancialStrategyData } from "../../api";
import {
  createFinancialStrategyViewModel,
  createInvestmentSafetyViewModel
} from "./financial-strategy-view-model";

describe("financial strategy presentation model", () => {
  it("keeps observed, estimated and projected provenance visible", () => {
    const viewModel = createFinancialStrategyViewModel(createFinancialStrategyData(), "USD", null);

    expect(viewModel.position).toMatchObject({
      statusLabel: "Healthy",
      cash: "USD 13,000,000",
      squadValue: "USD 42,000,000",
      squadValueCoverage: "2/3 players valued",
      liquidity: "23.2%",
      provenance: {
        cash: "Observed",
        squadValue: "Derived",
        developmentValue: "Projected"
      }
    });
    expect(viewModel.developmentCapital).toMatchObject({
      coveredPlayers: "2/3 players projected",
      valueCreation: "+USD 10,000,000"
    });
  });

  it("maps funding states, reasons, risks and protected assets without domain decisions in UI", () => {
    const viewModel = createFinancialStrategyViewModel(createFinancialStrategyData(), "USD", null);

    expect(viewModel.funding.needs).toEqual([
      expect.objectContaining({
        profile: "Goalkeeper",
        status: "Fully Funded",
        horizon: "Next season"
      }),
      expect.objectContaining({
        profile: "Central Defender",
        status: "Future need",
        gap: "USD 3,000,000"
      })
    ]);
    expect(viewModel.recommendations[0]).toMatchObject({
      title: "Fund Goalkeeper need",
      reasons: ["Priority Goalkeeper need", "Need is fully fundable within the protected capacity"],
      risks: ["The action would reduce liquidity"]
    });
    expect(viewModel.assets.protectedAssets[0]).toMatchObject({
      name: "Player 7",
      reasons: ["Core asset", "No ready successor"]
    });
  });

  it("presents investment simulation as derived and does not imply persistence", () => {
    const assessment: InvestmentSafetyAssessment = {
      amount: 2_000_000,
      postInvestmentCash: 11_000_000,
      postInvestmentStatus: "healthy",
      postInvestmentPayrollCoverageWeeks: 19.6,
      postInvestmentLiquidityRatio: 0.21,
      safety: "acceptable",
      reasons: []
    };

    expect(createInvestmentSafetyViewModel(assessment, "USD")).toEqual({
      cash: "USD 11,000,000",
      coverage: "19.6 weeks",
      status: "Healthy",
      safety: "Acceptable"
    });
  });
});

function createFinancialStrategyData(): FinancialStrategyData {
  const financialAssessment = {
    position: {
      cash: 13_000_000,
      squadAssetValue: {
        expected: 42_000_000,
        low: null,
        high: null,
        coverage: 2 / 3,
        valuedPlayers: 2,
        totalPlayers: 3,
        concentration: { top1Share: 0.25, top3Share: 0.39, top5Share: 0.39 },
        distribution: {
          core: 24_000_000,
          developing: 10_000_000,
          prospect: 8_000_000,
          rotation: 0,
          depth: 0,
          transition: 0
        }
      },
      knownPayroll: {
        playersWeekly: 340_000,
        trainersWeekly: 220_000,
        totalWeekly: 560_000,
        composition: { playerShare: 0.607, trainerShare: 0.393 },
        coverage: 1
      },
      knownCapital: { expected: 55_000_000, liquid: 13_000_000, illiquid: 42_000_000 },
      metrics: {
        payrollCoverageWeeks: 23.2,
        cashToSquadValueRatio: 0.31,
        liquidityRatio: 0.232,
        payrollToCashRatio: 0.04,
        assetConcentration: null
      },
      status: "healthy",
      confidence: "medium",
      provenance: {
        cash: "observed",
        knownPayroll: "derived",
        squadAssetValue: "derived",
        knownCapital: "derived",
        metrics: "derived",
        developmentCapital: "projected"
      },
      warnings: [],
      strengths: [{ type: "healthy_liquidity" }]
    },
    payroll: {
      playersWeekly: 340_000,
      trainersWeekly: 220_000,
      totalWeekly: 560_000,
      composition: { playerShare: 0.607, trainerShare: 0.393 },
      coverage: 1
    },
    squadAssets: {
      expected: 42_000_000,
      low: null,
      high: null,
      coverage: 2 / 3,
      valuedPlayers: 2,
      totalPlayers: 3,
      concentration: { top1Share: 0.25, top3Share: 0.39, top5Share: 0.39 },
      distribution: {
        core: 24_000_000,
        developing: 10_000_000,
        prospect: 8_000_000,
        rotation: 0,
        depth: 0,
        transition: 0
      }
    },
    developmentCapital: {
      currentValue: 21_400_000,
      projectedTargetValue: 31_800_000,
      projectedValueCreation: 10_000_000,
      playersCovered: 2,
      projectionCoverage: 2 / 3,
      confidence: "medium"
    },
    trends: { cash: null },
    strengths: [{ type: "healthy_liquidity" }],
    warnings: [],
    confidence: "medium"
  } as unknown as ClubFinancialAssessment;

  const capitalAllocation = {
    cash: 13_000_000,
    reserve: {
      minimumCashReserve: 5_400_000,
      reserveBasis: {
        knownPayrollWeeks: 10,
        amountFromPayroll: 5_600_000,
        additionalSafetyBuffer: 0
      },
      confidence: "medium"
    },
    spendableCash: { cash: 13_000_000, reservedCash: 5_400_000, availableCash: 7_600_000 },
    investmentCapacity: {
      immediate: 7_600_000,
      conservative: 5_000_000,
      maximumRecommended: 7_600_000,
      confidence: "medium"
    },
    horizonCapacity: { current: 7_600_000, nextSeason: 7_600_000, mediumTerm: 7_600_000 },
    strategicNeeds: [
      {
        id: "need-gk",
        profile: "goalkeeper",
        sourceRecommendationId: "squad-gk",
        horizon: "next_season",
        priority: "critical",
        type: "external_recruitment",
        estimatedCapitalRequirement: { low: 4_000_000, expected: 4_700_000, high: 5_500_000 },
        target: null,
        confidence: "medium"
      },
      {
        id: "need-def",
        profile: "central_defender",
        sourceRecommendationId: "squad-def",
        horizon: "medium_term",
        priority: "high",
        type: "external_recruitment",
        estimatedCapitalRequirement: { low: 3_000_000, expected: 3_800_000, high: 4_500_000 },
        target: null,
        confidence: "low"
      }
    ],
    allocation: [
      {
        strategicNeedId: "need-gk",
        allocatedAmount: 4_700_000,
        requiredRange: { low: 4_000_000, expected: 4_700_000, high: 5_500_000 },
        coverage: "fully_funded",
        priority: "critical",
        timing: "next_season"
      },
      {
        strategicNeedId: "need-def",
        allocatedAmount: 0,
        requiredRange: { low: 3_000_000, expected: 3_800_000, high: 4_500_000 },
        coverage: "unfunded",
        priority: "high",
        timing: "medium_term"
      }
    ],
    fundingGaps: [
      {
        strategicNeedId: "need-def",
        expectedRequirement: 3_800_000,
        allocated: 0,
        gap: 3_000_000,
        severity: "high"
      }
    ],
    unallocatedCapacity: 300_000,
    status: "sufficient",
    confidence: "medium",
    reasons: [],
    monetizableAssets: [
      {
        playerId: 7,
        estimatedMarketValue: 8_100_000,
        squadRole: "core",
        strategicImportance: 1,
        liquidityPotential: "low",
        confidence: "high"
      }
    ],
    potentialAssetLiquidity: null,
    extendedCapacity: {
      cashBacked: 7_600_000,
      potentialAssetLiquidity: null,
      theoreticalMaximum: null
    },
    opportunityCost: { cashLiquidityCost: 5_000_000, sportingAssetCost: null }
  } as unknown as CapitalAllocationPlan;

  const strategyPlan = {
    recommendations: [
      {
        id: "fund-gk",
        type: "fund_priority_need",
        priority: "critical",
        horizon: "next_season",
        profile: "goalkeeper",
        strategicNeedId: "need-gk",
        financialImpact: {
          estimatedCashCommitment: 4_700_000,
          postActionFinancialStatus: "healthy"
        },
        confidence: "medium",
        reasons: [
          { type: "priority_squad_need", profile: "goalkeeper" },
          { type: "need_fully_fundable" }
        ],
        risks: [{ type: "liquidity_reduction" }]
      }
    ],
    monetizationCandidates: [
      {
        playerId: 7,
        profile: "central_defender",
        marketValue: 8_100_000,
        squadRole: "core",
        profileStatus: "balanced",
        successorCoverage: "missing",
        currentContribution: 0.9,
        futureContribution: 0.9,
        trainingValueEfficiency: 10_000,
        projectedPeakValue: 8_100_000,
        monetizationScore: 0.1,
        strategicProtection: "critical",
        timing: {
          playerId: 7,
          currentValue: 8_100_000,
          shortTermPeakValue: 8_100_000,
          weeksToShortTermPeak: 0,
          additionalValue: 0,
          valueGainPerWeek: 0,
          resourceCost: { requiresAdvanced: false, competesWithHigherPriorityDevelopment: false },
          recommendation: "hold_asset"
        },
        confidence: "high",
        reasons: [{ type: "core_asset" }, { type: "missing_successor" }]
      }
    ],
    conflicts: [],
    liquidityScenarios: [],
    deploymentAssessments: [],
    summary: {
      preserveCash: false,
      investableCapital: 5_000_000,
      strategicFundingGap: 3_000_000,
      monetizationPotential: null,
      protectedAssetCount: 1
    },
    confidence: "medium"
  } as unknown as FinancialStrategyPlan;

  return { financialAssessment, capitalAllocation, strategyPlan };
}

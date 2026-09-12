import { describe, expect, it } from "vitest";
import { assessClubFinancialPosition, type FinancialPositionContext } from "../index.js";
import { inferPositionFromSkills, simulatePlayerAcquisition } from "../acquisition-simulator.js";
import type { SquadDepthAnalysis } from "../../squadPlanning/depth-types.js";
import type { SquadPlanningRecommendations } from "../../squadPlanning/recommendation-types.js";

function mockFinancialAssessment() {
  const context: FinancialPositionContext = {
    club: { budget: 10_000_000, currency: "ARS" },
    players: [
      { playerId: 1, wage: 100_000, squadRole: "core" },
      { playerId: 2, wage: 80_000, squadRole: "developing" }
    ],
    trainers: [{ trainerId: 10, salary: 20_000, active: true, contracted: true }],
    squadMarketValue: {
      players: [],
      ranking: [],
      totalEstimatedValue: 20_000_000,
      averageEstimatedValue: 10_000_000,
      medianEstimatedValue: 10_000_000,
      mostValuablePlayerIds: []
    },
    squadPlayerCount: 2
  };

  return assessClubFinancialPosition(context);
}

function mockSquadDepth(): SquadDepthAnalysis {
  const dummySnapshot = {
    availablePlayers: 1,
    strongOptions: 1,
    developingOptions: 0,
    prospects: 0,
    playerIds: [1],
    depthScore: 50
  };

  return {
    profiles: [
      {
        profile: "midfielder",
        requirement: {
          profile: "midfielder",
          minimum: 3,
          ideal: 4
        },
        current: dummySnapshot,
        nextSeason: dummySnapshot,
        mediumTerm: dummySnapshot,
        status: "critical",
        confidence: "high",
        dependencyRisk: null,
        reasons: [],
        succession: {
          successionRequired: true,
          outgoingPlayers: [],
          successorCandidates: [],
          coverageStatus: "missing"
        }
      },
      {
        profile: "defender",
        requirement: {
          profile: "defender",
          minimum: 3,
          ideal: 4
        },
        current: { ...dummySnapshot, availablePlayers: 6 },
        nextSeason: { ...dummySnapshot, availablePlayers: 6 },
        mediumTerm: { ...dummySnapshot, availablePlayers: 6 },
        status: "overstocked",
        confidence: "high",
        dependencyRisk: null,
        reasons: [],
        succession: {
          successionRequired: false,
          outgoingPlayers: [],
          successorCandidates: [],
          coverageStatus: "covered"
        }
      }
    ],
    summary: {
      criticalProfiles: 1,
      thinProfiles: 0,
      balancedProfiles: 0,
      deepProfiles: 0,
      overstockedProfiles: 1,
      missingSuccessions: 1,
      dependencyRisks: 0
    }
  };
}

function mockSquadPlanning(): SquadPlanningRecommendations {
  return {
    recommendations: [],
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
  };
}

describe("simulatePlayerAcquisition", () => {
  it("incorporates additional weekly payroll and updates payroll coverage", () => {
    const assessment = mockFinancialAssessment();
    const result = simulatePlayerAcquisition(
      {
        financialAssessment: assessment,
        squadDepth: mockSquadDepth(),
        squadPlanning: mockSquadPlanning()
      },
      {
        amount: 1_000_000,
        weeklyWage: 50_000,
        age: 24,
        position: "DEF"
      }
    );

    // Initial total weekly: 100k + 80k + 20k = 200k.
    expect(result.financial.currentWeeklyPayroll).toBe(200_000);
    // With 50k added: 250k.
    expect(result.financial.projectedWeeklyPayroll).toBe(250_000);
    // Post investment cash: 10M - 1M = 9M.
    expect(result.financial.postInvestmentCash).toBe(9_000_000);
    // Coverage with new payroll: 9M / 250k = 36 weeks.
    expect(result.financial.postInvestmentPayrollCoverageWeeks).toBeCloseTo(36, 1);
    expect(result.financial.safety).toBe("acceptable");
  });

  it("detects high need when position is in critical depth deficit", () => {
    const assessment = mockFinancialAssessment();
    const result = simulatePlayerAcquisition(
      {
        financialAssessment: assessment,
        squadDepth: mockSquadDepth(),
        squadPlanning: mockSquadPlanning()
      },
      {
        amount: 500_000,
        position: "MID",
        age: 26,
        skills: { playmaker: 11, passing: 9, technique: 8 }
      }
    );

    expect(result.squadFit.fitVerdict).toBe("high_need");
    expect(result.squadFit.profileStatus).toBe("critical");
    expect(result.squadFit.headline).toContain("Priority reinforcement");
  });

  it("detects overstocked risk when position already has excess players", () => {
    const assessment = mockFinancialAssessment();
    const result = simulatePlayerAcquisition(
      {
        financialAssessment: assessment,
        squadDepth: mockSquadDepth(),
        squadPlanning: mockSquadPlanning()
      },
      {
        amount: 500_000,
        position: "DEF",
        age: 27,
        skills: { defender: 8 }
      }
    );

    expect(result.squadFit.fitVerdict).toBe("overstocked_risk");
    expect(result.squadFit.profileStatus).toBe("overstocked");
    expect(result.squadFit.headline).toContain("Overstocking");
  });

  it("projects future ROI for youth players (<= 21 years)", () => {
    const assessment = mockFinancialAssessment();
    const result = simulatePlayerAcquisition(
      {
        financialAssessment: assessment,
        squadDepth: mockSquadDepth(),
        squadPlanning: mockSquadPlanning(),
        trainingConfiguration: { MID: 3 }, // Training priority 3 = Playmaking
        activeAdvancedTraineeCount: 1 // 1 slot used -> 1 slot available
      },
      {
        amount: 200_000,
        weeklyWage: 5_000,
        age: 17,
        position: "MID",
        skills: { playmaker: 8, passing: 6, technique: 6, pace: 7, stamina: 7 }
      }
    );

    expect(result.roi).not.toBeNull();
    expect(result.roi?.isYouthProjectable).toBe(true);
    expect(result.roi?.projectedValueSeason1).toBeGreaterThan(result.roi?.currentEstimatedValue ?? 0);
    expect(result.roi?.totalCostSeason1).toBe(200_000 + 5_000 * 16);
    expect(result.training.isCompatibleWithClubTraining).toBe(true);
    expect(result.training.trainedSkillName).toBe("Playmaking");
    expect(result.training.hasAdvancedSlotAvailable).toBe(true);
  });

  it("automatically derives purchase fee from market transfers and estimates wage when not provided", () => {
    const assessment = mockFinancialAssessment();
    const mockTransfers = [
      {
        transferId: "t-1",
        playerId: 101,
        name: "Comparable Midfielder",
        age: 18,
        transferDate: new Date(),
        gameWeek: 100,
        season: 25,
        week: 4,
        salePrice: 850_000,
        skills: { playmaker: 8, passing: 6, technique: 6, pace: 7, stamina: 7 },
        developmentProfile: "midfielder" as const,
        source: "imported" as const
      }
    ];

    const result = simulatePlayerAcquisition(
      {
        financialAssessment: assessment,
        squadDepth: mockSquadDepth(),
        squadPlanning: mockSquadPlanning(),
        marketTransfers: mockTransfers
      },
      {
        position: "MID",
        age: 18,
        skills: { playmaker: 8, passing: 6, technique: 6, pace: 7, stamina: 7 }
      }
    );

    // Purchase fee must be automatically resolved from market transfers
    expect(result.financial.amount).toBeGreaterThan(0);
    expect(result.financial.marketPriceSource).toMatch(/market_comparables|market_calibration|fundamental_valuation/);
    // Weekly wage must be automatically estimated
    expect(result.financial.weeklyWage).toBeGreaterThan(0);
    expect(result.financial.isWageEstimated).toBe(true);
    // Post investment cash must be reduced by the derived amount
    expect(result.financial.postInvestmentCash).toBe(10_000_000 - result.financial.amount);
    // Projected weekly payroll must be 200k + derived wage
    expect(result.financial.projectedWeeklyPayroll).toBe(200_000 + result.financial.weeklyWage);
  });
});

describe("inferPositionFromSkills", () => {
  it("infers GK when keeper skill is dominant and >= 4", () => {
    expect(inferPositionFromSkills({ keeper: 10, defender: 1, playmaker: 1, striker: 1 })).toBe("GK");
  });

  it("infers DEF when defending is dominant", () => {
    expect(inferPositionFromSkills({ keeper: 1, defender: 12, playmaker: 6, striker: 4, pace: 8, passing: 8 })).toBe("DEF");
  });

  it("infers MID when playmaker is dominant", () => {
    expect(inferPositionFromSkills({ keeper: 1, defender: 6, playmaker: 12, striker: 4, passing: 8 })).toBe("MID");
  });

  it("infers ATT when striker is dominant", () => {
    expect(inferPositionFromSkills({ keeper: 1, defender: 4, playmaker: 6, striker: 12, pace: 10 })).toBe("ATT");
  });

  it("defaults to MID when outfield skills are balanced and keeper is low", () => {
    expect(
      inferPositionFromSkills({
        stamina: 8,
        pace: 8,
        technique: 8,
        passing: 8,
        keeper: 1,
        defender: 8,
        playmaker: 8,
        striker: 8
      })
    ).toBe("MID");
  });

  it("infers position correctly inside simulatePlayerAcquisition when input.position is omitted", () => {
    const assessment = mockFinancialAssessment();
    const result = simulatePlayerAcquisition(
      {
        financialAssessment: assessment,
        squadDepth: mockSquadDepth(),
        squadPlanning: mockSquadPlanning()
      },
      {
        age: 20,
        skills: { defender: 13, pace: 10, technique: 7, passing: 6, playmaker: 4, striker: 2, keeper: 1 }
      }
    );

    expect(result.squadFit.targetProfile).toBe("defender");
    expect(result.input.position).toBe("DEF");
  });
});

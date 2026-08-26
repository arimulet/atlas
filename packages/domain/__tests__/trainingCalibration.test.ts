import { describe, expect, it } from "vitest";

import {
  buildAdvancedScoreBreakdown,
  buildTalentSensitivity,
  buildWeeklyTrainingCalibrationReport,
  calculateDevelopmentReturnScoreBreakdown,
  calculateRankingStability,
  calculateSkillUpBacktestSummary,
  createTrainingHistory,
  createTrainingWeek,
  detectRecommendationFlapping,
  selectTrainingCalibrationDataset,
  type AdvancedTrainingOptimization,
  type RecommendationCalibrationObservation,
  type TrainingWeekInput,
  type TrainingCalibrationPlayerContext,
  type WeeklyTrainingPlayerReport
} from "@atlas/domain";

const PLAYER_ID = 901;

function week(input: Partial<TrainingWeekInput> = {}) {
  return createTrainingWeek({
    playerId: PLAYER_ID,
    gameWeek: 1200,
    seasonWeek: 1,
    date: new Date("2026-08-01"),
    type: "pace",
    kind: "advanced",
    intensity: 100,
    age: 19,
    skills: { pace: 10, defending: 12 },
    skillsChange: { pace: 0, defending: 0, up: 0, down: 0 },
    ...input
  });
}

function observation(
  input: Partial<RecommendationCalibrationObservation> &
    Pick<RecommendationCalibrationObservation, "gameWeek" | "currentSkill" | "status">
): RecommendationCalibrationObservation {
  return {
    playerId: PLAYER_ID,
    currentScore: 0.5,
    bestAlternativeScore: 0.7,
    relativeImprovement: 0.4,
    confidence: "high",
    ...input
  };
}

function report(): WeeklyTrainingPlayerReport {
  return {
    playerId: PLAYER_ID,
    gameWeek: 1202,
    training: { skill: "pace", kind: "advanced", intensity: 100 },
    skill: { previousLevel: 10, currentLevel: 10, skillUp: false },
    trainingPoints: {
      earned: 100,
      estimatedProgress: null,
      remainingToNextLevel: null,
      estimatedWeeksToNextLevel: null
    }
  };
}

function emptyOptimization(): AdvancedTrainingOptimization {
  return {
    gameWeek: 1202,
    slotCount: 10,
    ranking: [],
    recommendedAdvancedPlayerIds: [],
    recommendations: [],
    replacements: [],
    summary: { currentlyAdvanced: 0, recommendedChanges: 0, promotions: 0, removals: 0 }
  };
}

describe("training calibration diagnostics", () => {
  it("calculates exact and bounded skill-up backtest metrics", () => {
    const predictions = [
      {
        playerId: 1,
        skill: "pace" as const,
        predictionWeek: 1200,
        observedSkillUpWeek: 1202,
        predictedWeeks: 2,
        actualWeeks: 2,
        errorWeeks: 0
      },
      {
        playerId: 2,
        skill: "defending" as const,
        predictionWeek: 1200,
        observedSkillUpWeek: 1203,
        predictedWeeks: 2,
        actualWeeks: 3,
        errorWeeks: 1
      },
      {
        playerId: 3,
        skill: "pace" as const,
        predictionWeek: 1200,
        observedSkillUpWeek: 1204,
        predictedWeeks: null,
        actualWeeks: 4,
        errorWeeks: null
      }
    ];

    expect(calculateSkillUpBacktestSummary(predictions)).toEqual({
      samples: 2,
      meanAbsoluteErrorWeeks: 0.5,
      medianAbsoluteErrorWeeks: 0.5,
      withinHalfWeek: 1,
      withinOneWeek: 2,
      withinTwoWeeks: 2
    });
  });

  it("excludes predictions without an estimable ETA", () => {
    const summary = calculateSkillUpBacktestSummary([
      {
        playerId: 1,
        skill: "pace",
        predictionWeek: 1200,
        observedSkillUpWeek: 1202,
        predictedWeeks: null,
        actualWeeks: 2,
        errorWeeks: null
      }
    ]);

    expect(summary.samples).toBe(0);
    expect(summary.meanAbsoluteErrorWeeks).toBeNull();
  });

  it("detects a reversal between two skill switches but not one legitimate switch", () => {
    expect(
      detectRecommendationFlapping([
        observation({ gameWeek: 1200, currentSkill: "defending", status: "continue" }),
        observation({
          gameWeek: 1201,
          currentSkill: "defending",
          status: "switch_skill",
          recommendedSkill: "pace"
        }),
        observation({
          gameWeek: 1202,
          currentSkill: "pace",
          status: "switch_skill",
          recommendedSkill: "defending"
        })
      ])
    ).toEqual([PLAYER_ID]);

    expect(
      detectRecommendationFlapping([
        observation({
          gameWeek: 1201,
          currentSkill: "defending",
          status: "switch_skill",
          recommendedSkill: "pace"
        }),
        observation({ gameWeek: 1202, currentSkill: "pace", status: "continue" })
      ])
    ).toEqual([]);
  });

  it("reports ranking stability and meaningful movement", () => {
    expect(
      calculateRankingStability(
        [
          { playerId: 1, rank: 10 },
          { playerId: 2, rank: 11 }
        ],
        [
          { playerId: 1, rank: 10 },
          { playerId: 2, rank: 8 }
        ]
      )
    ).toEqual([
      { playerId: 1, currentRank: 10, previousRank: 10, rankDelta: 0 },
      { playerId: 2, currentRank: 11, previousRank: 8, rankDelta: 3 }
    ]);
  });

  it("keeps the advanced score decomposition tied to marginal gain", () => {
    const option = calculateDevelopmentReturnScoreBreakdown({
      age: 19,
      talent: 1,
      skill: "pace",
      currentSkillLevel: 10,
      expectedWeeklyTrainingPoints: 100
    });
    const breakdown = buildAdvancedScoreBreakdown({
      marginalTrainingPoints: 50,
      developmentPotentialScore: option!.developmentReturnScore,
      optionBreakdown: option
    });

    expect(breakdown).not.toBeNull();
    expect(breakdown!.finalScore).toBeCloseTo(
      breakdown!.marginalTrainingGain * breakdown!.developmentPotential
    );
    expect(breakdown!.ageContribution).toBeGreaterThan(0);
  });

  it("exposes talent sensitivity without changing the Talent algorithm", () => {
    const sensitivity = buildTalentSensitivity({
      scoreInput: {
        age: 19,
        skill: "pace",
        currentSkillLevel: 10,
        expectedWeeklyTrainingPoints: 100
      },
      talent: 1,
      uncertainty: 0.1
    });

    expect(sensitivity).toHaveLength(3);
    expect(sensitivity[0]!.developmentReturnScore).not.toBe(
      sensitivity[2]!.developmentReturnScore
    );
  });

  it("aggregates insufficient evidence and keeps recommendation confidence separate", () => {
    const history = createTrainingHistory(PLAYER_ID, [week({ gameWeek: 1202 })]);
    const calibration = buildWeeklyTrainingCalibrationReport({
      players: [
        {
          player: {
            playerId: PLAYER_ID,
            age: 19,
            position: "defender",
            skills: { pace: 10, defending: 12 }
          },
          trainingHistory: history,
          currentTraining: { skill: "pace", kind: "advanced", intensity: 100 }
        }
      ],
      weeklyReport: {
        gameWeek: 1202,
        date: new Date("2026-08-15"),
        players: [report()],
        summary: {
          trainedPlayers: 1,
          advancedPlayers: 1,
          formationPlayers: 0,
          skillUps: 0,
          averageIntensity: 100
        }
      },
      recommendations: [
        {
          playerId: PLAYER_ID,
          status: "continue",
          currentSkill: "pace",
          currentOption: {
            skill: "pace",
            currentLevel: 10,
            estimatedWeeksToNextLevel: null,
            requiredTrainingPoints: null,
            expectedWeeklyTrainingPoints: 100,
            developmentReturnScore: null
          },
          alternatives: [],
          confidence: "high",
          reasons: []
        }
      ],
      advancedOptimization: emptyOptimization()
    });

    expect(calibration.players[0]!.confidence).toBe("low");
    expect(calibration.warnings).toContainEqual(
      expect.objectContaining({ warning: "insufficient_history" })
    );
    expect(calibration.recommendations.continue).toBe(1);
    expect(calibration.recommendations.hold).toBe(0);
  });

  it("selects a deterministic calibration subset without embedding player ids", () => {
    const contexts: TrainingCalibrationPlayerContext[] = Array.from({ length: 13 }, (_, index) => {
      const playerId = 1000 + index;
      return {
        player: {
          playerId,
          age: 18 + (index % 5),
          position: index % 2 === 0 ? "defender" : "midfielder",
          skills: { pace: 8 + index, defending: 10 + index }
        },
        trainingHistory: createTrainingHistory(playerId, [
          week({ playerId, gameWeek: 1200 + index })
        ]),
        currentTraining: {
          skill: "pace",
          kind: index % 2 === 0 ? "advanced" : "formation",
          intensity: 100
        }
      };
    });

    const selection = selectTrainingCalibrationDataset(contexts);

    expect(selection.analyzedPlayers).toBe(13);
    expect(selection.players).toHaveLength(12);
    expect(selection.players.map((context) => context.player.playerId)).toEqual(
      expect.arrayContaining([1000, 1001])
    );
    expect(selection.scenarios.some((entry) => entry.scenarios.includes("advanced"))).toBe(true);
    expect(selection.scenarios.some((entry) => entry.scenarios.includes("formation"))).toBe(true);
  });
});

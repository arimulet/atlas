import { describe, expect, it } from "vitest";

import type {
  AdvancedTrainingOptimization,
  AdvancedTrainingPlayerRecommendation,
  PlayerTrainingRecommendation
} from "@atlas/domain";
import type { TrainingPageData, WeeklyTrainingIntelligence } from "../../types";
import {
  createTrainingIntelligenceViewModel,
  filterTrainingOverview,
  type TrainingOverviewRow
} from "./training-intelligence-view-model";

const training: TrainingPageData = {
  snapshotId: "snapshot-1",
  snapshotDate: "2026-08-20",
  configuration: { GK: 2, DEF: 6, MID: 7, ATT: 7 },
  players: [
    { id: "1", playerId: 1, name: "Gómez", age: 18, training: { position: 1, advanced: true } },
    { id: "2", playerId: 2, name: "Martínez", age: 19, training: { position: 2, advanced: true } },
    { id: "3", playerId: 3, name: "Pérez", age: 18, training: { position: 2, advanced: false } },
    { id: "4", playerId: 4, name: "Fernández", age: 23, training: { position: 1, advanced: true } }
  ],
  history: []
};

function recommendation(
  playerId: number,
  status: PlayerTrainingRecommendation["status"],
  skill: "defending" | "pace",
  recommendedSkill?: "defending" | "pace"
): PlayerTrainingRecommendation {
  return {
    playerId,
    status,
    currentSkill: skill,
    recommendedSkill,
    currentOption: {
      skill,
      currentLevel: 12,
      estimatedWeeksToNextLevel: 3.2,
      requiredTrainingPoints: 320,
      expectedWeeklyTrainingPoints: 100,
      developmentReturnScore: 0.6
    },
    alternatives: [],
    confidence: status === "hold" ? "low" : "high",
    reasons:
      status === "switch_skill"
        ? [
            {
              type: "better_alternative",
              currentSkill: skill,
              alternativeSkill: recommendedSkill ?? "pace",
              improvement: 0.31
            }
          ]
        : status === "hold"
          ? [{ type: "insufficient_history" }]
          : [{ type: "stable_current_skill", skill }]
  };
}

const intelligence: WeeklyTrainingIntelligence = {
  report: {
    gameWeek: 1205,
    date: "2026-08-20T00:00:00.000Z",
    players: [
      {
        playerId: 1,
        gameWeek: 1205,
        training: { skill: "defending", kind: "advanced", intensity: 100 },
        skill: { previousLevel: 12, currentLevel: 13, skillUp: true },
        trainingPoints: {
          earned: 100,
          estimatedProgress: 74,
          remainingToNextLevel: 26,
          estimatedWeeksToNextLevel: 1.3
        }
      },
      {
        playerId: 2,
        gameWeek: 1205,
        training: { skill: "pace", kind: "advanced", intensity: 92 },
        skill: { previousLevel: 11, currentLevel: 11, skillUp: false },
        trainingPoints: {
          earned: 92,
          estimatedProgress: null,
          remainingToNextLevel: null,
          estimatedWeeksToNextLevel: null
        }
      },
      {
        playerId: 3,
        gameWeek: 1205,
        training: { skill: "pace", kind: "formation", intensity: 100 },
        skill: { previousLevel: 10, currentLevel: 10, skillUp: false },
        trainingPoints: {
          earned: 100,
          estimatedProgress: 18,
          remainingToNextLevel: 82,
          estimatedWeeksToNextLevel: 3.8
        }
      },
      {
        playerId: 4,
        gameWeek: 1205,
        training: { skill: "defending", kind: "advanced", intensity: 100 },
        skill: { previousLevel: 13, currentLevel: 13, skillUp: false },
        trainingPoints: {
          earned: 100,
          estimatedProgress: 4,
          remainingToNextLevel: 96,
          estimatedWeeksToNextLevel: 4.4
        }
      }
    ],
    summary: {
      trainedPlayers: 4,
      advancedPlayers: 3,
      formationPlayers: 1,
      skillUps: 1,
      averageIntensity: 98
    }
  },
  recommendations: [
    recommendation(1, "switch_skill", "defending", "pace"),
    recommendation(2, "continue", "pace"),
    recommendation(3, "hold", "pace"),
    recommendation(4, "continue", "defending")
  ],
  advancedOptimization: {
    gameWeek: 1205,
    slotCount: 10,
    ranking: [
      {
        playerId: 1,
        rank: 1,
        score: 0.94,
        currentlyAdvanced: true,
        isTrial: false,
        recommendedAdvanced: true,
        confidence: "high"
      },
      {
        playerId: 3,
        rank: 9,
        score: 0.84,
        currentlyAdvanced: false,
        isTrial: false,
        recommendedAdvanced: true,
        confidence: "high"
      },
      {
        playerId: 4,
        rank: 12,
        score: 0.58,
        currentlyAdvanced: true,
        isTrial: false,
        recommendedAdvanced: false,
        confidence: "high"
      }
    ],
    recommendedAdvancedPlayerIds: [1, 3],
    recommendations: [
      advancedRecommendation(1, "keep_advanced", true, true),
      advancedRecommendation(3, "promote_to_advanced", false, true),
      advancedRecommendation(4, "remove_from_advanced", true, false)
    ],
    replacements: [
      {
        promotePlayerId: 3,
        removePlayerId: 4,
        scoreDifference: 0.26,
        confidence: "high",
        reasons: [{ type: "better_candidate_available", playerId: 3, scoreDifference: 0.26 }]
      }
    ],
    summary: { currentlyAdvanced: 3, recommendedChanges: 2, promotions: 1, removals: 1 }
  } satisfies AdvancedTrainingOptimization
};

function advancedRecommendation(
  playerId: number,
  status: AdvancedTrainingPlayerRecommendation["status"],
  currentlyAdvanced: boolean,
  recommendedAdvanced: boolean
) {
  return {
    playerId,
    status,
    currentlyAdvanced,
    recommendedAdvanced,
    evaluation: {
      playerId,
      currentSkill: "pace" as const,
      advancedScore: 0.8,
      expectedAdvancedTrainingPoints: 100,
      expectedFormationTrainingPoints: 50,
      marginalTrainingPoints: 50,
      developmentPotentialScore: 0.8,
      confidence: "high" as const
    },
    reasons: [{ type: "within_recommended_top_slots" as const, rank: 1 }]
  };
}

describe("createTrainingIntelligenceViewModel", () => {
  it("maps summary, attention and advanced replacements", () => {
    const viewModel = createTrainingIntelligenceViewModel({ training, intelligence });

    expect(viewModel.summary).toMatchObject({
      gameWeek: 1205,
      trainedPlayers: 4,
      skillUps: 1,
      averageIntensity: 98
    });
    expect(viewModel.attention.some((item) => item.type === "switch_skill")).toBe(true);
    expect(viewModel.attention.some((item) => item.type === "slot_replacement")).toBe(true);
    expect(viewModel.replacements[0]).toMatchObject({
      promotePlayerName: "Pérez",
      removePlayerName: "Fernández",
      promoteRank: 9,
      removeRank: 12
    });
  });

  it("does not put a normal continue recommendation in attention", () => {
    const viewModel = createTrainingIntelligenceViewModel({ training, intelligence });

    expect(
      viewModel.attention.some((item) => item.playerId === 2 && item.type === "switch_skill")
    ).toBe(false);
  });

  it("distinguishes a trial advanced recommendation and explains its validation period", () => {
    const trialIntelligence: WeeklyTrainingIntelligence = {
      ...intelligence,
      advancedOptimization: {
        ...intelligence.advancedOptimization,
        ranking: intelligence.advancedOptimization.ranking.map((entry) =>
          entry.playerId === 3 ? { ...entry, isTrial: true } : entry
        ),
        recommendations: intelligence.advancedOptimization.recommendations.map((entry) =>
          entry.playerId === 3 ? advancedRecommendation(3, "trial_advanced", false, true) : entry
        )
      }
    };

    const viewModel = createTrainingIntelligenceViewModel({
      training,
      intelligence: trialIntelligence
    });
    const attention = viewModel.attention.find((item) => item.playerId === 3);

    expect(viewModel.advancedRows.find((row) => row.playerId === 3)?.status).toBe("Trial advanced");
    expect(attention).toMatchObject({ title: "Trial advanced training" });
    expect(attention?.description).toContain("provisional advanced-training trial");
  });

  it("preserves skill-up, progress and insufficient next-level states", () => {
    const viewModel = createTrainingIntelligenceViewModel({ training, intelligence });
    const Gomez = viewModel.overviewRows.find((row) => row.playerId === 1);
    const Martinez = viewModel.overviewRows.find((row) => row.playerId === 2);

    expect(Gomez).toMatchObject({ skillUp: true, progress: 74, nextSkillUp: 1.3 });
    expect(Martinez).toMatchObject({ progress: null, nextSkillUp: null });
    expect(viewModel.hasInsufficientData).toBe(true);
  });

  it("supports the requested overview filters", () => {
    const viewModel = createTrainingIntelligenceViewModel({ training, intelligence });

    expect(filterTrainingOverview(viewModel.overviewRows, "advanced")).toHaveLength(3);
    expect(filterTrainingOverview(viewModel.overviewRows, "formation")).toHaveLength(1);
    expect(
      filterTrainingOverview(viewModel.overviewRows, "skill-ups").map((row) => row.playerId)
    ).toEqual([1]);
  });
});

describe("filterTrainingOverview", () => {
  it("filters attention without changing the prepared row model", () => {
    const rows: TrainingOverviewRow[] = [
      {
        playerId: 1,
        playerName: "A",
        age: 18,
        skill: "Pace",
        previousLevel: null,
        level: 10,
        trainingKind: "Advanced",
        intensity: 100,
        progress: null,
        nextSkillUp: null,
        skillUp: false,
        recommendation: "Continue",
        confidence: "high",
        isAdvanced: true,
        hasAttention: true
      }
    ];

    expect(filterTrainingOverview(rows, "attention")).toEqual(rows);
  });
});

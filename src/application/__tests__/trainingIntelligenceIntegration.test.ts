import { describe, expect, it } from "vitest";

import {
  buildTrainingRecommendationsFromLoadedData,
  buildWeeklyTrainingIntelligenceFromLoadedData
} from "../training/index.js";
import type {
  PersistedPlayer,
  PersistedPlayerTrainingWeek,
  PersistedSnapshot
} from "../../database/repositories/types.js";

describe("Training intelligence with club training configuration", () => {
  const basePlayer: PersistedPlayer = {
    id: "p1",
    playerId: 100,
    clubId: 1,
    name: "Witold Żubrowski",
    surname: "Żubrowski",
    age: 24,
    position: "DEF",
    developmentPlan: {
      position: "defender",
      targetRating: 15,
      targetLevel: 15,
      targetSeasonWeek: 16,
      targetSeason: 78,
      priority: "high",
      targetAge: 25,
      focusSkills: ["defending"],
      planGeneratedAt: new Date(),
      status: "in_progress",
      targetSkillLevels: { defending: 15 },
      path: [
        {
          order: 1,
          skill: "defending",
          currentLevel: 13,
          targetLevel: 15,
          weeksRemaining: 4,
          status: "in_progress",
          efficiency: "optimal",
          priorityScore: 1
        }
      ]
    },
    skills: {
      stamina: 8,
      keeper: 1,
      pace: 12,
      defending: 13,
      passing: 8,
      technique: 8,
      playmaking: 5,
      striker: 3
    }
  };

  const baseReport: PersistedPlayerTrainingWeek = {
    id: "tw1",
    playerId: 100,
    clubId: 1,
    gameWeek: 1204,
    season: 78,
    seasonWeek: 7,
    date: "2026-08-12",
    type: "pace",
    kind: "formation",
    intensity: 100,
    formation: "MID",
    age: 24,
    skills: {
      stamina: 8,
      keeper: 1,
      pace: 12,
      defending: 13,
      passing: 8,
      technique: 8,
      playmaking: 5,
      striker: 3
    },
    skillsChange: { up: 0, down: 0 },
    skillChanges: []
  };

  const baseSnapshot: PersistedSnapshot = {
    id: "s1",
    clubId: 1,
    gameWeek: 1204,
    season: 78,
    seasonWeek: 7,
    date: new Date("2026-08-12"),
    players: [
      {
        playerId: 100,
        name: "Witold Żubrowski",
        age: 24,
        training: {
          position: 2, // MID historical snapshot
          advanced: false
        },
        skills: {
          stamina: 8,
          keeper: 1,
          pace: 12,
          defending: 13,
          passing: 8,
          technique: 8,
          playmaking: 5,
          striker: 3
        }
      }
    ]
  };

  const trainingConfiguration = {
    GK: 2,
    DEF: 6, // defending
    MID: 8, // pace
    ATT: 7
  };

  it("recommends continue when active player position in trainingConfiguration matches planned skill", () => {
    const recommendations = buildTrainingRecommendationsFromLoadedData(
      [baseReport],
      [baseSnapshot],
      [basePlayer],
      1204,
      trainingConfiguration
    );

    expect(recommendations).toHaveLength(1);
    const rec = recommendations[0]!;
    expect(rec.status).toBe("continue");
    expect(rec.currentSkill).toBe("defending");
    expect(rec.recommendedSkill).toBeUndefined();
    expect(rec.reasons).toContainEqual(
      expect.objectContaining({
        type: "aligned_with_development_plan",
        skill: "defending"
      })
    );
  });

  it("falls back to weekly report skill if trainingConfiguration is not provided", () => {
    const recommendations = buildTrainingRecommendationsFromLoadedData(
      [baseReport],
      [baseSnapshot],
      [basePlayer],
      1204
    );

    expect(recommendations).toHaveLength(1);
    const rec = recommendations[0]!;
    expect(rec.status).toBe("switch_skill");
    expect(rec.currentSkill).toBe("pace");
    expect(rec.recommendedSkill).toBe("defending");
    expect(rec.reasons).toContainEqual(
      expect.objectContaining({
        type: "development_plan_step",
        currentSkill: "pace",
        plannedSkill: "defending"
      })
    );
  });

  it("propagates training configuration into weekly training intelligence", () => {
    const intelligence = buildWeeklyTrainingIntelligenceFromLoadedData(
      [baseReport],
      [baseSnapshot],
      [],
      [basePlayer],
      1204,
      trainingConfiguration
    );

    const rec = intelligence.recommendations[0]!;
    expect(rec.status).toBe("continue");
    expect(rec.currentSkill).toBe("defending");
  });
});

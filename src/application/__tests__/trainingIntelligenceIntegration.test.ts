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
    countryId: null,
    age: 24,
    position: "DEF",
    development: {
      profile: "defender",
      objective: "sportive",
      targetLevels: { defender: 15 }
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
    },
    marketValue: null,
    wage: null,
    cards: { yellow: 0, red: 0 },
    injury: { days: null, severe: null },
    currentGameWeek: 1204
  };

  const baseReport: PersistedPlayerTrainingWeek = {
    id: "tw1",
    playerId: 100,
    clubId: 1,
    gameWeek: 1204,
    season: 78,
    seasonWeek: 7,
    date: new Date("2026-08-12"),
    type: "pace",
    kind: "formation",
    intensity: 100,
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
    schemaVersion: "1",
    snapshotDate: new Date("2026-08-12"),
    gameWeek: 1204,
    week: 7,
    importedAt: new Date("2026-08-12"),
    players: [
      {
        id: "sp1",
        playerId: 100,
        name: "Witold Żubrowski",
        age: 24,
        wage: 0,
        value: 0,
        form: null,
        availabilityStatus: "available",
        observedPosition: "defender",
        training: {
          position: 2, // MID historical snapshot
          advanced: false
        },
        skills: {
          stamina: 8,
          keeper: 1,
          pace: 17,
          defender: 13,
          passing: 13,
          technique: 14,
          playmaker: 5,
          striker: 3
        }
      }
    ],
    juniors: []
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

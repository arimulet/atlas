import type { PersistedSnapshot } from "@atlas/database";
import { describe, expect, it } from "vitest";

import { calculateLatestCompletedYouthSkillChanges } from "./index.js";

describe("calculateLatestCompletedYouthSkillChanges", () => {
  it("ignores the active game week and compares the last two completed trainings", () => {
    const changes = calculateLatestCompletedYouthSkillChanges([
      createSnapshot(24, 6),
      createSnapshot(25, 7),
      createSnapshot(26, 8)
    ]);

    expect(changes).toEqual(new Map([[101, 1]]));
  });

  it("uses the latest snapshot of each completed game week", () => {
    const changes = calculateLatestCompletedYouthSkillChanges([
      createSnapshot(24, 6),
      createSnapshot(25, 7),
      createSnapshot(25, 8),
      createSnapshot(26, 8)
    ]);

    expect(changes).toEqual(new Map([[101, 2]]));
  });
});

function createSnapshot(gameWeek: number, skill: number): PersistedSnapshot {
  return {
    id: `snapshot-${gameWeek}-${skill}`,
    clubId: 1,
    schemaVersion: "1",
    snapshotDate: new Date(`2026-08-${String(gameWeek).padStart(2, "0")}T12:00:00.000Z`),
    gameWeek,
    week: gameWeek,
    importedAt: new Date(`2026-08-${String(gameWeek).padStart(2, "0")}T12:00:00.000Z`),
    players: [],
    juniors: [
      {
        id: `junior-${gameWeek}-${skill}`,
        playerId: 101,
        name: "Ana Silva",
        age: 16,
        initialLevel: null,
        weeksRemaining: 8,
        skill,
        status: "in_academy"
      }
    ]
  };
}

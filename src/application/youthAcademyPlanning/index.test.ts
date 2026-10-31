import type { PersistedSnapshot } from "@atlas/database";
import { describe, expect, it } from "vitest";

import {
  calculateLatestCompletedYouthSkillChanges,
  calculateProjectedPromotionAge,
  calculateProjectedPromotionWeek,
  calculateYouthDevelopmentMetrics
} from "./index.js";

describe("calculateLatestCompletedYouthSkillChanges", () => {
  it("compares the two most recent game weeks", () => {
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
      createSnapshot(25, 6),
      createSnapshot(26, 7),
      createSnapshot(26, 8)
    ]);

    expect(changes).toEqual(new Map([[101, 2]]));
  });

  it("does not infer a training change when the previous week is missing", () => {
    const changes = calculateLatestCompletedYouthSkillChanges([
      createSnapshot(24, 6),
      createSnapshot(26, 8)
    ]);

    expect(changes).toEqual(new Map());
  });

  it("uses game weeks rather than snapshot import order", () => {
    const changes = calculateLatestCompletedYouthSkillChanges([
      createSnapshot(26, 8),
      createSnapshot(24, 6),
      createSnapshot(25, 7)
    ]);

    expect(changes).toEqual(new Map([[101, 1]]));
  });
});

describe("calculateYouthDevelopmentMetrics", () => {
  it("derives pops, talent, and expected level from the academy history", () => {
    expect(
      calculateYouthDevelopmentMetrics({
        initialLevel: 6,
        initialWeeks: 10,
        currentLevel: 8,
        weeksRemaining: 4
      })
    ).toEqual({ levelPops: 2, talent: 3, expectedLevel: 9 });
  });

  it("estimates the expected level with talent 4 until a level pop has been observed", () => {
    expect(
      calculateYouthDevelopmentMetrics({
        initialLevel: 6,
        initialWeeks: 10,
        currentLevel: 6,
        weeksRemaining: 4
      })
    ).toEqual({ levelPops: 0, talent: null, expectedLevel: 7 });
  });

  it("uses the assumed talent when the initial level is missing", () => {
    expect(calculateYouthDevelopmentMetrics({ initialLevel: null, initialWeeks: null, currentLevel: 8, weeksRemaining: 8 }))
      .toEqual({ levelPops: null, talent: null, expectedLevel: 10 });
  });

  it("does not invent an expected level without the current level or remaining weeks", () => {
    expect(calculateYouthDevelopmentMetrics({ initialLevel: 6, initialWeeks: 10, currentLevel: null, weeksRemaining: 4 }).expectedLevel).toBeNull();
    expect(calculateYouthDevelopmentMetrics({ initialLevel: 6, initialWeeks: 10, currentLevel: 6, weeksRemaining: null }).expectedLevel).toBeNull();
  });

  it("caps the estimated level at 17", () => {
    expect(calculateYouthDevelopmentMetrics({ initialLevel: 16, initialWeeks: 30, currentLevel: 16, weeksRemaining: 20 }).expectedLevel).toBe(17);
  });

  it("estimates the level when the initial level is unavailable", () => {
    expect(calculateYouthDevelopmentMetrics({ initialLevel: null, initialWeeks: null, currentLevel: 7, weeksRemaining: 8 }))
      .toEqual({ levelPops: null, talent: null, expectedLevel: 9 });
  });
});
describe("calculateProjectedPromotionAge", () => {
  it("accounts for the season change before promotion", () => {
    expect(
      calculateProjectedPromotionAge({ age: 19, currentSeasonWeek: 10, weeksRemaining: 14 })
    ).toBe(20);
  });

  it("keeps the current age when promotion happens before the season ends", () => {
    expect(
      calculateProjectedPromotionAge({ age: 19, currentSeasonWeek: 10, weeksRemaining: 3 })
    ).toBe(19);
  });
});

describe("calculateProjectedPromotionWeek", () => {
  it.each([[7, 0, 7], [7, 1, 8], [13, 1, 1], [10, 30, 1]] as const)(
    "projects week %i with %i weeks remaining", (week, remaining, expected) => {
      expect(calculateProjectedPromotionWeek(week, remaining)).toBe(expected);
    }
  );

  it("returns null for missing or invalid inputs", () => {
    expect(calculateProjectedPromotionWeek(null, 1)).toBeNull();
    expect(calculateProjectedPromotionWeek(1, -1)).toBeNull();
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

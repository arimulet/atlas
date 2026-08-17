import { describe, expect, it } from "vitest";

import {
  mapApiTrainingPlayerToPlayerTrainingWeekDto,
  mapTrainingKind,
  mapTrainingType
} from "../src/importer/providers/api/mappers.js";
import type { SokkerApiTrainingPlayerDto } from "../src/importer/providers/api/dtos.js";

function apiReport(kind: string): SokkerApiTrainingPlayerDto {
  return {
    id: 40098056,
    report: {
      week: 1204,
      day: {
        season: 78,
        week: 1204,
        seasonWeek: 8,
        date: { value: "2026-08-13" }
      },
      skills: { pace: 11, passing: 10 },
      skillsChange: { pace: 1, passing: 1, up: 2, down: 0 },
      type: { code: 8, name: "pace" },
      kind: { code: 1, name: kind },
      games: { minutesOfficial: 0, minutesFriendly: 90, minutesNational: 0 },
      intensity: 85,
      formation: null,
      age: 20
    }
  };
}

describe("Sokker JSON training mapper", () => {
  it.each([
    ["individual", "advanced"],
    ["formation", "formation"],
    ["missing", "missing"]
  ] as const)("maps %s to %s", (name, expected) => {
    expect(mapTrainingKind(name)).toBe(expected);
  });

  it("maps training type names centrally", () => {
    expect(mapTrainingType("general")).toBe("general");
    expect(mapTrainingType("defending")).toBe("defending");
  });

  it("keeps intensity and skillsChange and drops games from the canonical DTO", () => {
    const mapped = mapApiTrainingPlayerToPlayerTrainingWeekDto(apiReport("formation"));

    expect(mapped).toMatchObject({
      playerId: 40098056,
      type: "pace",
      kind: "formation",
      intensity: 85,
      skillsChange: { pace: 1, passing: 1, up: 2, down: 0 }
    });
    expect(mapped).not.toHaveProperty("games");
  });

  it("accepts a null formation because it is transport-only", () => {
    expect(() => mapApiTrainingPlayerToPlayerTrainingWeekDto(apiReport("missing"))).not.toThrow();
  });
});

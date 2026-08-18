import trainingFixture from "../../test-fixtures/fixtures/sokker-json-api/training.fixture.json" with { type: "json" };
import { describe, expect, it } from "vitest";

import {
  mapApiTrainingPlayerToPlayerTrainingWeekDto,
  mapTrainingKind,
  mapTrainingType
} from "../src/importer/providers/api/mappers.js";
import type { SokkerTrainingApiDto } from "../src/importer/providers/api/dtos.js";

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

  it("accepts zero intensity, null formation and negative skill changes", () => {
    const training = trainingFixture as SokkerTrainingApiDto;
    const mapped = mapApiTrainingPlayerToPlayerTrainingWeekDto(training.players[0]!);

    expect(mapped).toMatchObject({
      intensity: 0,
      skillsChange: { pace: 1, passing: -1, up: 1, down: 1 },
      skillChanges: [
        { skill: "pace", before: 10, after: 11, delta: 1, direction: "up" },
        { skill: "passing", before: 11, after: 10, delta: -1, direction: "down" }
      ]
    });
    expect(mapped).not.toHaveProperty("games");
  });
});

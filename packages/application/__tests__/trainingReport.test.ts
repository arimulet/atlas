import trainingFixture from "../../test-fixtures/fixtures/sokker-json-api/training.fixture.json" with { type: "json" };
import { describe, expect, it } from "vitest";

import {
  mapTrainingPlayerApiToTrainingWeek,
  mapTrainingKind,
  mapTrainingType
} from "../src/importer/providers/api/mappers.js";
import type { SokkerTrainingApiDto } from "../src/importer/providers/api/dtos.js";

describe("Sokker JSON training mapper", () => {
  it.each([
    [{ code: 1, name: "individual" }, "advanced"],
    [{ code: 2, name: "formation" }, "formation"],
    [{ code: 3, name: "missing" }, "missing"]
  ] as const)("maps kind %o", (source, expected) => {
    expect(mapTrainingKind(source)).toBe(expected);
  });

  it("maps type names centrally", () => {
    expect(mapTrainingType({ code: 0, name: "general" })).toBe("general");
    expect(mapTrainingType({ code: 6, name: "defending" })).toBe("defending");
  });

  it("keeps factual report week/date, zero intensity and skills changes", () => {
    const training = trainingFixture as SokkerTrainingApiDto;
    const mapped = mapTrainingPlayerApiToTrainingWeek(training.players[0]!);

    expect(mapped).toMatchObject({
      gameWeek: 1204,
      season: 78,
      seasonWeek: 7,
      date: "2026-08-12",
      intensity: 0,
      formation: null,
      skillsChange: { pace: 1, passing: -1, up: 1, down: 1 },
      skillChanges: [
        { skill: "pace", before: 10, after: 11, delta: 1, direction: "up" },
        { skill: "passing", before: 11, after: 10, delta: -1, direction: "down" }
      ]
    });
    expect(mapped).not.toHaveProperty("games");
  });
});

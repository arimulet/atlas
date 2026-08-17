import { describe, expect, it } from "vitest";

import {
  createTrainingHistory,
  createTrainingWeek,
  detectSkillUps,
  type TrainingWeekInput
} from "@atlas/domain";

function report(overrides: Partial<TrainingWeekInput> = {}): TrainingWeekInput {
  return {
    playerId: 40098056,
    gameWeek: 1204,
    seasonWeek: 8,
    date: new Date("2026-08-13"),
    type: "pace",
    kind: "advanced",
    intensity: 100,
    age: 20,
    skills: { pace: 11, passing: 10 },
    skillsChange: { pace: 0, passing: 0, up: 0, down: 0 },
    ...overrides
  };
}

describe("Sokker training reports", () => {
  it.each([
    ["advanced", "advanced"],
    ["formation", "formation"],
    ["missing", "missing"]
  ] as const)("keeps kind %s as %s", (kind, expected) => {
    const week = createTrainingWeek(report({ kind }));

    expect(week.kind).toBe(expected);
  });

  it("uses the official intensity without deriving it from games", () => {
    const week = createTrainingWeek(report({ intensity: 85, kind: "formation" }));

    expect(week.intensity).toBe(85);
    expect(week.trainingPoints).toBe(85);
  });

  it("persists zero intensity as a valid observation", () => {
    const week = createTrainingWeek(report({ intensity: 0, kind: "missing" }));

    expect(week.intensity).toBe(0);
    expect(week.trainingPoints).toBe(0);
  });

  it("detects skill ups from the official skillsChange values", () => {
    const first = createTrainingWeek(report({ gameWeek: 1203 }));
    const second = createTrainingWeek(
      report({
        skills: { pace: 11, passing: 11 },
        skillsChange: { pace: 1, passing: 1, up: 2, down: 0 }
      })
    );

    const skillUps = detectSkillUps(createTrainingHistory(40098056, [first, second]));

    expect(skillUps).toEqual([
      expect.objectContaining({ skill: "pace", fromLevel: 10, toLevel: 11, levelDelta: 1 }),
      expect.objectContaining({ skill: "passing", fromLevel: 10, toLevel: 11, levelDelta: 1 })
    ]);
  });
});

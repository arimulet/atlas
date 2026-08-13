import { describe, expect, it } from "vitest";
import {
  BASE_TRAINING_POINTS,
  calculateRequiredTrainingPoints,
  estimateTalent
} from "../src/index.js";

describe("required training points", () => {
  it("returns the base points at the age and skill baselines", () => {
    const result = calculateRequiredTrainingPoints({
      talent: 1,
      age: 16,
      skill: "technique",
      targetSkillLevel: 6
    });

    expect(BASE_TRAINING_POINTS).toBe(47);
    expect(result).toMatchObject({
      talent: 1,
      ageCostFactor: 1,
      skillCostFactor: 1,
      baseTrainingPoints: 47,
      requiredTrainingPoints: 47
    });
  });

  it("scales linearly with talent", () => {
    const result = calculateRequiredTrainingPoints({
      talent: 3.5,
      age: 16,
      skill: "technique",
      targetSkillLevel: 6
    });

    expect(result.requiredTrainingPoints).toBeCloseTo(164.5, 10);
  });

  it("increases required points with age", () => {
    const young = calculateRequiredTrainingPoints({
      talent: 3.5,
      age: 18,
      skill: "technique",
      targetSkillLevel: 6
    });
    const older = calculateRequiredTrainingPoints({
      talent: 3.5,
      age: 20,
      skill: "technique",
      targetSkillLevel: 6
    });

    expect(older.requiredTrainingPoints).toBeGreaterThan(young.requiredTrainingPoints);
    expect(older.ageCostFactor).toBeGreaterThan(young.ageCostFactor);
  });

  it("increases required points with the target skill level", () => {
    const target8 = calculateRequiredTrainingPoints({
      talent: 3.5,
      age: 20,
      skill: "technique",
      targetSkillLevel: 8
    });
    const target11 = calculateRequiredTrainingPoints({
      talent: 3.5,
      age: 20,
      skill: "technique",
      targetSkillLevel: 11
    });

    expect(target11.requiredTrainingPoints).toBeGreaterThan(target8.requiredTrainingPoints);
  });

  it("applies the current skill type cost ratio", () => {
    const pace = calculateRequiredTrainingPoints({
      talent: 3.5,
      age: 20,
      skill: "pace",
      targetSkillLevel: 11
    });
    const technique = calculateRequiredTrainingPoints({
      talent: 3.5,
      age: 20,
      skill: "technique",
      targetSkillLevel: 11
    });

    expect(pace.requiredTrainingPoints / technique.requiredTrainingPoints).toBeCloseTo(1.197, 3);
  });

  it("matches the reference example approximately", () => {
    const result = calculateRequiredTrainingPoints({
      talent: 3.5,
      age: 20,
      skill: "technique",
      targetSkillLevel: 11
    });

    expect(result.requiredTrainingPoints).toBeCloseTo(369, 0);
    expect(result.ageCostFactor).toBeCloseTo(1.432, 3);
    expect(result.skillCostFactor).toBeCloseTo(1.567, 3);
  });

  it.each([
    ["talent", { talent: 0 }],
    ["age", { age: 15 }],
    ["targetSkillLevel", { targetSkillLevel: 18.5 }]
  ])("rejects invalid %s", (_field, override) => {
    expect(() =>
      calculateRequiredTrainingPoints({
        talent: 1,
        age: 16,
        skill: "technique",
        targetSkillLevel: 6,
        ...override
      })
    ).toThrow();
  });
});

describe("talent estimation", () => {
  it("inverts required training points", () => {
    const required = calculateRequiredTrainingPoints({
      talent: 3.5,
      age: 20,
      skill: "technique",
      targetSkillLevel: 11
    });
    const estimated = estimateTalent({
      observedTrainingPoints: required.requiredTrainingPoints,
      age: 20,
      skill: "technique",
      targetSkillLevel: 11
    });

    expect(estimated.estimatedTalent).toBeCloseTo(3.5, 10);
    expect(estimated.baseTrainingPoints).toBe(47);
  });

  it.each([
    [1, 16, "technique", 6],
    [2.25, 18, "pace", 8],
    [3.5, 20, "technique", 11],
    [4.75, 24, "passing", 14],
    [7, 30, "scoring", 18]
  ] as const)("preserves talent on round trip", (talent, age, skill, targetSkillLevel) => {
    const required = calculateRequiredTrainingPoints({
      talent,
      age,
      skill,
      targetSkillLevel
    });
    const estimated = estimateTalent({
      observedTrainingPoints: required.requiredTrainingPoints,
      age,
      skill,
      targetSkillLevel
    });

    expect(estimated.estimatedTalent).toBeCloseTo(talent, 10);
  });

  it("rejects non-positive observed training points", () => {
    expect(() =>
      estimateTalent({
        observedTrainingPoints: 0,
        age: 20,
        skill: "technique",
        targetSkillLevel: 11
      })
    ).toThrow("observedTrainingPoints must be a finite positive number.");
  });
});

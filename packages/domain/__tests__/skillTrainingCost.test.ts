import { describe, expect, it } from "vitest";
import {
  SKILL_LEVEL_TRAINING_FACTOR,
  SKILL_TRAINING_BASE_LEVEL,
  calculateSkillTrainingCostFactor,
  calculateSkillTrainingSpeedFactor
} from "../src/index.js";

describe("skill training cost factor", () => {
  it("uses the configured empirical factor and baselines", () => {
    expect(SKILL_LEVEL_TRAINING_FACTOR).toBe(1.094);
    expect(SKILL_TRAINING_BASE_LEVEL).toEqual({
      pace: 4,
      scoring: 4,
      defending: 6,
      technique: 6,
      playmaking: 6,
      passing: 6
    });
  });

  it("returns a baseline cost for technique level 6", () => {
    expect(calculateSkillTrainingCostFactor({ skill: "technique", targetSkillLevel: 6 })).toEqual({
      skill: "technique",
      targetSkillLevel: 6,
      baseLevel: 6,
      exponent: 0,
      costFactor: 1
    });
  });

  it("calculates one level above the technique baseline", () => {
    const result = calculateSkillTrainingCostFactor({ skill: "technique", targetSkillLevel: 7 });

    expect(result.exponent).toBe(1);
    expect(result.costFactor).toBeCloseTo(1.094, 3);
  });

  it("calculates technique level 11", () => {
    const result = calculateSkillTrainingCostFactor({ skill: "technique", targetSkillLevel: 11 });

    expect(result).toMatchObject({ baseLevel: 6, exponent: 5 });
    expect(result.costFactor).toBeCloseTo(1.567, 3);
  });

  it("uses the lower baseline for pace and scoring", () => {
    const pace = calculateSkillTrainingCostFactor({ skill: "pace", targetSkillLevel: 11 });
    const scoring = calculateSkillTrainingCostFactor({ skill: "scoring", targetSkillLevel: 11 });

    expect(pace.costFactor).toBeCloseTo(1.876, 3);
    expect(scoring.costFactor).toBeCloseTo(1.876, 3);
    expect(
      pace.costFactor /
        calculateSkillTrainingCostFactor({ skill: "technique", targetSkillLevel: 11 }).costFactor
    ).toBeCloseTo(1.197, 3);
  });

  it("increases the cost as the target level increases", () => {
    const level8 = calculateSkillTrainingCostFactor({ skill: "technique", targetSkillLevel: 8 });
    const level11 = calculateSkillTrainingCostFactor({ skill: "technique", targetSkillLevel: 11 });

    expect(level11.costFactor / level8.costFactor).toBeCloseTo(1.309, 3);
  });

  it("returns the inverse speed factor", () => {
    const cost = calculateSkillTrainingCostFactor({ skill: "technique", targetSkillLevel: 11 });

    expect(
      calculateSkillTrainingSpeedFactor({ skill: "technique", targetSkillLevel: 11 })
    ).toBeCloseTo(1 / cost.costFactor, 10);
  });

  it.each(["goalkeeping", "stamina", "keeper"])('rejects unsupported skill "%s"', (skill) => {
    expect(() =>
      calculateSkillTrainingCostFactor({
        skill: skill as never,
        targetSkillLevel: 11
      })
    ).toThrow("skill must be one of");
  });

  it.each([-1, 18.5, 19, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid target level %s",
    (targetSkillLevel) => {
      expect(() =>
        calculateSkillTrainingCostFactor({ skill: "technique", targetSkillLevel })
      ).toThrow("targetSkillLevel must be an integer between 0 and 18.");
    }
  );
});

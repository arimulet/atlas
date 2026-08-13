import { describe, expect, it } from "vitest";
import {
  calculateAdvancedTrainingEfficiency,
  calculateEquivalentTrainingMinutes,
  calculateFormationTrainingEfficiency,
  calculateTrainingEfficiency
} from "../src/index.js";

interface EfficiencyCase {
  name: string;
  officialMinutes: number;
  friendlyMinutes: number;
  equivalentMinutes: number;
  formationEfficiency: number;
  advancedEfficiency: number;
}

const efficiencyCases: EfficiencyCase[] = [
  {
    name: "without minutes",
    officialMinutes: 0,
    friendlyMinutes: 0,
    equivalentMinutes: 0,
    formationEfficiency: 0,
    advancedEfficiency: 50
  },
  {
    name: "full friendly",
    officialMinutes: 0,
    friendlyMinutes: 90,
    equivalentMinutes: 67.5,
    formationEfficiency: 70,
    advancedEfficiency: 85
  },
  {
    name: "full official",
    officialMinutes: 90,
    friendlyMinutes: 0,
    equivalentMinutes: 90,
    formationEfficiency: 93,
    advancedEfficiency: 96
  },
  {
    name: "friendly plus few official minutes",
    officialMinutes: 20,
    friendlyMinutes: 90,
    equivalentMinutes: 87.5,
    formationEfficiency: 90,
    advancedEfficiency: 95
  },
  {
    name: "friendly plus 25 official minutes",
    officialMinutes: 25,
    friendlyMinutes: 90,
    equivalentMinutes: 92.5,
    formationEfficiency: 93,
    advancedEfficiency: 96
  },
  {
    name: "friendly plus 70 official minutes",
    officialMinutes: 70,
    friendlyMinutes: 90,
    equivalentMinutes: 137.5,
    formationEfficiency: 97,
    advancedEfficiency: 98
  },
  {
    name: "full friendly plus full official",
    officialMinutes: 90,
    friendlyMinutes: 90,
    equivalentMinutes: 157.5,
    formationEfficiency: 98,
    advancedEfficiency: 99
  },
  {
    name: "121 official minutes",
    officialMinutes: 121,
    friendlyMinutes: 0,
    equivalentMinutes: 121,
    formationEfficiency: 95,
    advancedEfficiency: 97
  },
  {
    name: "maximum efficiency",
    officialMinutes: 180,
    friendlyMinutes: 0,
    equivalentMinutes: 180,
    formationEfficiency: 100,
    advancedEfficiency: 100
  },
  {
    name: "more than maximum equivalent minutes",
    officialMinutes: 181,
    friendlyMinutes: 0,
    equivalentMinutes: 181,
    formationEfficiency: 100,
    advancedEfficiency: 100
  }
];

describe("training efficiency", () => {
  it.each(efficiencyCases)("$name", (testCase) => {
    const result = calculateTrainingEfficiency({
      officialMinutes: testCase.officialMinutes,
      friendlyMinutes: testCase.friendlyMinutes,
      advancedTraining: true
    });

    expect(result).toEqual({
      equivalentMinutes: testCase.equivalentMinutes,
      formationEfficiency: testCase.formationEfficiency,
      trainingEfficiency: testCase.advancedEfficiency,
      trainingType: "advanced"
    });
  });

  it("uses formation efficiency as the final efficiency for formation training", () => {
    const result = calculateTrainingEfficiency({
      officialMinutes: 90,
      friendlyMinutes: 0,
      advancedTraining: false
    });

    expect(result).toEqual({
      equivalentMinutes: 90,
      formationEfficiency: 93,
      trainingEfficiency: 93,
      trainingType: "formation"
    });
  });

  it("exposes the individual calculation steps", () => {
    expect(calculateEquivalentTrainingMinutes(20, 90)).toBe(87.5);
    expect(calculateFormationTrainingEfficiency(87.5)).toBe(90);
    expect(calculateAdvancedTrainingEfficiency(90)).toBe(95);
  });

  it.each([
    ["officialMinutes", -1, 0],
    ["friendlyMinutes", 0, -1]
  ])("rejects negative %s", (fieldName, officialMinutes, friendlyMinutes) => {
    expect(() =>
      calculateTrainingEfficiency({
        officialMinutes,
        friendlyMinutes,
        advancedTraining: false
      })
    ).toThrow(`${fieldName} must be a finite non-negative number.`);
  });

  it("rejects non-finite minutes", () => {
    expect(() => calculateEquivalentTrainingMinutes(Number.NaN, 0)).toThrow(
      "officialMinutes must be a finite non-negative number."
    );
    expect(() => calculateEquivalentTrainingMinutes(0, Number.POSITIVE_INFINITY)).toThrow(
      "friendlyMinutes must be a finite non-negative number."
    );
  });

  it("rejects an invalid formation efficiency", () => {
    expect(() => calculateAdvancedTrainingEfficiency(101)).toThrow(
      "formationEfficiency must be between 0 and 100."
    );
  });
});

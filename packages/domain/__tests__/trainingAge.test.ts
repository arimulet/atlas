import { describe, expect, it } from "vitest";
import {
  AGE_TRAINING_FACTOR,
  BASE_TRAINING_AGE,
  calculateAgeTrainingCostFactor,
  calculateRelativeTrainingSpeed
} from "../src/index.js";

describe("training age factor", () => {
  it("uses 16 years as the base age", () => {
    expect(BASE_TRAINING_AGE).toBe(16);
    expect(AGE_TRAINING_FACTOR).toBe(1.094);
    expect(calculateAgeTrainingCostFactor(16)).toBeCloseTo(1, 10);
    expect(calculateRelativeTrainingSpeed(16)).toBeCloseTo(1, 10);
  });

  it.each([
    [17, 1.094, 0.914],
    [18, 1.197, 0.836],
    [20, 1.43, 0.698],
    [24, 2.05, 0.487],
    [30, 3.52, 0.284]
  ])("calculates the empirical factor for age %i", (age, expectedCost, expectedSpeed) => {
    expect(calculateAgeTrainingCostFactor(age)).toBeCloseTo(expectedCost, 2);
    expect(calculateRelativeTrainingSpeed(age)).toBeCloseTo(expectedSpeed, 2);
  });

  it("keeps relative speed as the inverse of age cost", () => {
    const ageCost = calculateAgeTrainingCostFactor(24);

    expect(calculateRelativeTrainingSpeed(24)).toBeCloseTo(1 / ageCost, 10);
  });

  it.each([15, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid age %s", (age) => {
    expect(() => calculateAgeTrainingCostFactor(age)).toThrow(
      "age must be a finite number greater than or equal to 16."
    );
    expect(() => calculateRelativeTrainingSpeed(age)).toThrow(
      "age must be a finite number greater than or equal to 16."
    );
  });
});

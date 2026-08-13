import { describe, expect, it } from "vitest";
import {
  buildSkillUpObservations,
  calculateAgeTrainingCostFactor,
  calculateSkillTrainingCostFactor,
  createTrainingHistory,
  createTrainingWeek,
  estimateTalentFromSkillUpObservation,
  type TrainingSkillLevels,
  type TrainingWeekInput
} from "../src/index.js";

const levels = (technique: number, passing = 8): TrainingSkillLevels => ({
  technique,
  passing
});

function week(overrides: Partial<TrainingWeekInput> = {}) {
  const input: TrainingWeekInput = {
    playerId: 42,
    week: 100,
    skill: "technique",
    officialMinutes: 90,
    friendlyMinutes: 0,
    advancedTraining: false,
    playerAge: 18,
    skillLevelBefore: 10,
    skillLevelAfter: 10,
    skillLevelsBefore: levels(10),
    skillLevelsAfter: levels(10),
    ...overrides
  };

  return createTrainingWeek(input);
}

function completeObservation(variableAge = false) {
  const history = createTrainingHistory(42, [
    week({
      week: 100,
      skillLevelsBefore: levels(10),
      skillLevelsAfter: levels(10)
    }),
    week({
      week: 101,
      skillLevelsBefore: levels(10),
      skillLevelsAfter: levels(11)
    }),
    week({
      week: 102,
      playerAge: 18,
      skillLevelsBefore: levels(11),
      skillLevelsAfter: levels(11)
    }),
    week({
      week: 103,
      playerAge: variableAge ? 19 : 18,
      skill: "passing",
      skillLevelBefore: 8,
      skillLevelAfter: 8,
      skillLevelsBefore: levels(11, 8),
      skillLevelsAfter: levels(11, 8)
    }),
    week({
      week: 104,
      playerAge: variableAge ? 20 : 18,
      skillLevelsBefore: levels(11),
      skillLevelsAfter: levels(12),
      skillLevelBefore: 11,
      skillLevelAfter: 11
    })
  ]);

  return buildSkillUpObservations(history)[1]!;
}

describe("talent observation", () => {
  it("uses the constant weekly age when the interval has no age change", () => {
    const observation = estimateTalentFromSkillUpObservation(completeObservation());

    expect(observation.observedTrainingPoints).toBe(186);
    expect(observation.effectiveAgeCostFactor).toBeCloseTo(
      calculateAgeTrainingCostFactor(18)
    );
    expect(observation.effectiveAge).toBeCloseTo(18);
  });

  it("weights the effective age by relevant training points", () => {
    const source = completeObservation(true);
    const observation = estimateTalentFromSkillUpObservation(source);
    const expectedAgeCostFactor =
      (calculateAgeTrainingCostFactor(18) + calculateAgeTrainingCostFactor(20)) / 2;
    const skillCost = calculateSkillTrainingCostFactor({
      skill: "technique",
      targetSkillLevel: 12
    });

    expect(observation.effectiveAgeCostFactor).toBeCloseTo(expectedAgeCostFactor);
    expect(observation.effectiveAge).toBeCloseTo(
      16 + Math.log(expectedAgeCostFactor) / Math.log(1.094)
    );
    expect(observation.estimatedTalent).toBeCloseTo(
      186 / (expectedAgeCostFactor * skillCost.costFactor * 47)
    );
    expect(observation.sourceObservation).toBe(source);
  });

  it("does not estimate talent from an incomplete observation", () => {
    const source = completeObservation();
    const incompleteObservation = {
      ...source,
      completeness: "missing-weeks" as const,
      eligibleForTalentEstimation: false
    };

    expect(() => estimateTalentFromSkillUpObservation(incompleteObservation)).toThrow(
      "Only complete SkillUpObservations can estimate talent."
    );
  });
});

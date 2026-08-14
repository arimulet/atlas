import { describe, expect, it } from "vitest";
import {
  buildSkillUpObservations,
  buildTalentObservationProfile,
  calculateAgeTrainingCostFactor,
  calculateSkillTrainingCostFactor,
  createTrainingHistory,
  createTrainingWeek,
  estimateTalentFromSkillUpObservation,
  type TalentObservation,
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

function talentObservation(overrides: Partial<TalentObservation> = {}): TalentObservation {
  const base = estimateTalentFromSkillUpObservation(completeObservation());

  return {
    ...base,
    ...overrides,
    sourceObservation: {
      ...base.sourceObservation,
      skill: overrides.skill ?? base.sourceObservation.skill,
      fromLevel: overrides.fromLevel ?? base.sourceObservation.fromLevel,
      toLevel: overrides.toLevel ?? base.sourceObservation.toLevel,
      popWeek: overrides.popWeek ?? base.sourceObservation.popWeek
    }
  };
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

  it("aggregates comparable observations using the median and preserves their levels", () => {
    const first = talentObservation({
      estimatedTalent: 3.5,
      popWeek: 104,
      fromLevel: 11,
      toLevel: 12
    });
    const second = talentObservation({
      estimatedTalent: 4.5,
      popWeek: 204,
      fromLevel: 12,
      toLevel: 13
    });
    const third = talentObservation({
      estimatedTalent: 5.5,
      popWeek: 304,
      fromLevel: 13,
      toLevel: 14
    });

    const profile = buildTalentObservationProfile({
      playerId: 42,
      observations: [first, second, third]
    });

    expect(profile.skills.technique).toMatchObject({
      observationCount: 3,
      targetSkillLevels: [12, 13, 14],
      medianEstimatedTalent: 4.5,
      minimumEstimatedTalent: 3.5,
      maximumEstimatedTalent: 5.5,
      status: "sufficient_data"
    });
    expect(profile.skills.technique.observations).toEqual([first, second, third]);
  });

  it("keeps skills separate and marks a single observation as insufficient", () => {
    const technique = talentObservation({ estimatedTalent: 3.5, popWeek: 104 });
    const passing = talentObservation({
      skill: "passing",
      estimatedTalent: 4,
      popWeek: 204
    });

    const profile = buildTalentObservationProfile({
      playerId: 42,
      observations: [technique, passing]
    });

    expect(profile.skills.technique.observationCount).toBe(1);
    expect(profile.skills.technique.status).toBe("insufficient_data");
    expect(profile.skills.passing.observationCount).toBe(1);
    expect(profile.skills.passing.status).toBe("insufficient_data");
  });

  it("rejects duplicate events and observations from another player", () => {
    const source = talentObservation({ popWeek: 104 });

    expect(() =>
      buildTalentObservationProfile({
        playerId: 42,
        observations: [source, source]
      })
    ).toThrow("TalentObservation event technique|104 already exists in the profile.");

    expect(() =>
      buildTalentObservationProfile({
        playerId: 42,
        observations: [talentObservation({ playerId: 43 })]
      })
    ).toThrow("All TalentObservations must belong to the profile playerId.");
  });
});
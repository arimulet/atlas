import { describe, expect, it } from "vitest";
import {
  AGE_TRAINING_FACTOR,
  BASE_TRAINING_AGE,
  SKILL_LEVEL_TRAINING_FACTOR,
  SKILL_TRAINING_BASE_LEVEL,
  calculateAdvancedTrainingEfficiency,
  calculateAgeTrainingCostFactor,
  calculateEquivalentTrainingMinutes,
  calculateFormationTrainingEfficiency,
  calculateRelativeTrainingSpeed,
  buildTalentProfile,
  calculateSkillProgressObservation,
  calculateSkillTrainingCostFactor,
  calculateSkillTrainingSpeedFactor,
  calculateTrainingEfficiency,
  DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS,
  type SkillProgressObservationInput
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

const baseInput: SkillProgressObservationInput = {
  playerId: 42,
  skill: "pace",
  fromLevel: 8,
  toLevel: 9,
  ageAtStart: 18,
  ageAtEnd: 18.1,
  trainingType: "formation",
  assignedPosition: 2,
  calendarCycles: 3,
  startSnapshotId: "snapshot-1",
  endSnapshotId: "snapshot-2",
  trainingEfficiencies: [100, 75, 100]
};

describe("skill progress observation", () => {
  it("calculates calendar and effective weeks per level", () => {
    const observation = calculateSkillProgressObservation(baseInput);

    expect(observation).toMatchObject({
      playerId: 42,
      skill: "pace",
      status: "progressed",
      fromLevel: 8,
      toLevel: 9,
      levelDelta: 1,
      calendarCycles: 3,
      effectiveTrainingCycles: 2.75,
      effectiveTrainingCyclesSource: "observed",
      calendarWeeksPerLevel: 3,
      effectiveWeeksPerLevel: 2.75,
      confidence: "high"
    });
  });

  it("uses calendar cycles as an explicit full-effectiveness assumption when efficiencies are absent", () => {
    const input = { ...baseInput, trainingEfficiencies: undefined };
    const observation = calculateSkillProgressObservation(input);

    expect(observation.effectiveTrainingCycles).toBe(3);
    expect(observation.effectiveTrainingCyclesSource).toBe("assumed-full-effectiveness");
    expect(observation.effectiveWeeksPerLevel).toBe(3);
    expect(observation.confidence).toBe("medium");
  });

  it("keeps multi-level transitions but lowers confidence", () => {
    const observation = calculateSkillProgressObservation({
      ...baseInput,
      fromLevel: 8,
      toLevel: 10
    });

    expect(observation.levelDelta).toBe(2);
    expect(observation.calendarWeeksPerLevel).toBe(1.5);
    expect(observation.effectiveWeeksPerLevel).toBe(1.375);
    expect(observation.confidence).toBe("low");
  });

  it("represents no visible increase as a censored observation", () => {
    const observation = calculateSkillProgressObservation({
      ...baseInput,
      fromLevel: 8,
      toLevel: 8
    });

    expect(observation.status).toBe("censored");
    expect(observation.levelDelta).toBe(0);
    expect(observation.calendarWeeksPerLevel).toBeNull();
    expect(observation.effectiveWeeksPerLevel).toBeNull();
    expect(observation.confidence).toBe("low");
  });

  it("allows unknown training context but keeps the observation usable", () => {
    const observation = calculateSkillProgressObservation({
      ...baseInput,
      trainingType: null,
      assignedPosition: null,
      trainingEfficiencies: undefined
    });

    expect(observation.trainingType).toBeNull();
    expect(observation.assignedPosition).toBeNull();
    expect(observation.effectiveWeeksPerLevel).toBe(3);
    expect(observation.confidence).toBe("medium");
  });

  it.each([
    ["fromLevel", { fromLevel: 19 }],
    ["toLevel", { toLevel: -1 }],
    ["ageAtStart", { ageAtStart: 15 }],
    ["calendarCycles", { calendarCycles: 0 }],
    ["assignedPosition", { assignedPosition: 4 as never }]
  ])("rejects invalid %s", (_field, override) => {
    expect(() => calculateSkillProgressObservation({ ...baseInput, ...override })).toThrow();
  });

  it("rejects a decreasing skill level", () => {
    expect(() =>
      calculateSkillProgressObservation({ ...baseInput, fromLevel: 9, toLevel: 8 })
    ).toThrow("toLevel must be greater than or equal to fromLevel.");
  });

  it("rejects incomplete or invalid efficiency evidence", () => {
    expect(() =>
      calculateSkillProgressObservation({ ...baseInput, trainingEfficiencies: [100, 100] })
    ).toThrow("trainingEfficiencies must contain one value per calendar cycle.");

    expect(() =>
      calculateSkillProgressObservation({ ...baseInput, trainingEfficiencies: [100, 101, 100] })
    ).toThrow("trainingEfficiencies values must be between 0 and 100.");
  });

  it("rejects skills excluded from the current progress model", () => {
    expect(() =>
      calculateSkillProgressObservation({ ...baseInput, skill: "stamina" as never })
    ).toThrow("skill must be one of");
  });
});

function observation(overrides: Partial<SkillProgressObservationInput> = {}) {
  const talentBaseInput: SkillProgressObservationInput = {
    ...baseInput,
    trainingEfficiencies: undefined
  };

  return calculateSkillProgressObservation({ ...talentBaseInput, ...overrides });
}

describe("talent profile", () => {
  it("uses two comparable observations as the default minimum", () => {
    const profile = buildTalentProfile({ playerId: 42, observations: [] });

    expect(DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS).toBe(2);
    expect(profile.minimumComparableObservations).toBe(2);
    expect(profile.skills.pace.segments).toEqual([]);
    expect(profile.skills.scoring.observations).toEqual([]);
  });

  it("groups observations by skill and comparable context", () => {
    const profile = buildTalentProfile({
      playerId: 42,
      observations: [
        observation({ calendarCycles: 3, startSnapshotId: "s-1", endSnapshotId: "s-2" }),
        observation({ calendarCycles: 5, startSnapshotId: "s-2", endSnapshotId: "s-3" }),
        observation({
          skill: "scoring",
          startSnapshotId: "s-3",
          endSnapshotId: "s-4"
        }),
        observation({
          assignedPosition: 1,
          startSnapshotId: "s-4",
          endSnapshotId: "s-5"
        })
      ]
    });

    expect(profile.skills.pace.observations).toHaveLength(3);
    expect(profile.skills.pace.segments).toHaveLength(2);
    expect(profile.skills.scoring.progressionCount).toBe(1);
    expect(profile.skills.scoring.segments[0]?.targetSkillLevel).toBe(9);
  });

  it("summarizes comparable observations using medians", () => {
    const profile = buildTalentProfile({
      playerId: 42,
      observations: [
        observation({ calendarCycles: 3, startSnapshotId: "s-1", endSnapshotId: "s-2" }),
        observation({ calendarCycles: 5, startSnapshotId: "s-2", endSnapshotId: "s-3" })
      ]
    });

    expect(profile.skills.pace.segments).toHaveLength(1);
    expect(profile.skills.pace.segments[0]).toMatchObject({
      targetSkillLevel: 9,
      ageAtStart: 18,
      comparableObservationCount: 2,
      calendarWeeksPerLevel: 4,
      effectiveWeeksPerLevel: 4,
      effectiveTrainingCyclesSource: "assumed-full-effectiveness",
      status: "sufficient_data",
      confidence: "medium",
      evidence: [
        { startSnapshotId: "s-1", endSnapshotId: "s-2" },
        { startSnapshotId: "s-2", endSnapshotId: "s-3" }
      ]
    });
  });

  it("keeps censored observations without using them as progression speed", () => {
    const profile = buildTalentProfile({
      playerId: 42,
      observations: [
        observation({ fromLevel: 8, toLevel: 8 }),
        observation({ startSnapshotId: "s-2", endSnapshotId: "s-3" })
      ]
    });

    expect(profile.skills.pace.censoredCount).toBe(1);
    expect(profile.skills.pace.progressionCount).toBe(1);
    expect(profile.skills.pace.segments[0]?.comparableObservationCount).toBe(1);
    expect(profile.skills.pace.segments[0]?.status).toBe("insufficient_data");
    expect(profile.skills.pace.segments[0]?.calendarWeeksPerLevel).toBe(3);
  });

  it("keeps effective training source mixed when observations combine measured and assumed cycles", () => {
    const profile = buildTalentProfile({
      playerId: 42,
      observations: [
        observation({
          trainingEfficiencies: [100, 100, 100],
          startSnapshotId: "s-1",
          endSnapshotId: "s-2"
        }),
        observation({ startSnapshotId: "s-2", endSnapshotId: "s-3" })
      ]
    });

    expect(profile.skills.pace.segments[0]?.effectiveTrainingCyclesSource).toBe("mixed");
  });

  it("preserves age and target level as separate profile segments", () => {
    const profile = buildTalentProfile({
      playerId: 42,
      observations: [
        observation({ startSnapshotId: "s-1", endSnapshotId: "s-2" }),
        observation({
          ageAtStart: 19,
          ageAtEnd: 19.1,
          startSnapshotId: "s-2",
          endSnapshotId: "s-3"
        }),
        observation({
          fromLevel: 9,
          toLevel: 10,
          ageAtStart: 19,
          ageAtEnd: 19.1,
          startSnapshotId: "s-3",
          endSnapshotId: "s-4"
        })
      ]
    });

    expect(
      profile.skills.pace.segments.map((segment) => [segment.targetSkillLevel, segment.ageAtStart])
    ).toEqual([
      [9, 18],
      [9, 19],
      [10, 19]
    ]);
  });

  it("rejects observations from another player", () => {
    expect(() =>
      buildTalentProfile({
        playerId: 42,
        observations: [observation({ playerId: 43 })]
      })
    ).toThrow("All observations must belong to the profile playerId.");
  });

  it("allows a custom minimum observation threshold", () => {
    const profile = buildTalentProfile({
      playerId: 42,
      minimumComparableObservations: 3,
      observations: [
        observation({ startSnapshotId: "s-1", endSnapshotId: "s-2" }),
        observation({ startSnapshotId: "s-2", endSnapshotId: "s-3" })
      ]
    });

    expect(profile.skills.pace.segments[0]?.status).toBe("insufficient_data");
    expect(profile.skills.pace.segments[0]?.confidence).toBe("low");
  });

  it("rejects an invalid minimum observation threshold", () => {
    expect(() =>
      buildTalentProfile({ playerId: 42, observations: [], minimumComparableObservations: 0 })
    ).toThrow("minimumComparableObservations must be a positive integer.");
  });
});

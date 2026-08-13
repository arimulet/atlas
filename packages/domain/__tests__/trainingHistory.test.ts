import { describe, expect, it } from "vitest";
import {
  addTrainingWeek,
  buildSkillUpObservations,
  createTrainingHistory,
  createTrainingWeek,
  detectSkillUps,
  getTrainingWeeks,
  getTrainingWeeksBetween,
  getTrainingWeeksForSkill,
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

describe("training week", () => {
  it("derives training efficiency and points from the existing calculator", () => {
    const trainingWeek = week();

    expect(trainingWeek.trainingEfficiency).toBe(93);
    expect(trainingWeek.trainingPoints).toBe(93);
  });

  it("keeps the observed training values and validates invariants", () => {
    expect(() => week({ officialMinutes: -1 })).toThrow(
      "officialMinutes must be a finite non-negative number."
    );
    expect(() => week({ playerAge: 15 })).toThrow(
      "playerAge must be a finite number greater than or equal to 16."
    );
    expect(() => week({ skillLevelAfter: 19 })).toThrow(
      "skillLevelAfter must be an integer between 0 and 18."
    );
  });
});

describe("training history", () => {
  it("orders weeks regardless of insertion order", () => {
    const history = createTrainingHistory(42, [week({ week: 102 }), week({ week: 100 })]);

    expect(getTrainingWeeks(history).map((entry) => entry.week)).toEqual([100, 102]);
    expect(getTrainingWeeksBetween(history, 100, 101).map((entry) => entry.week)).toEqual([100]);
    expect(getTrainingWeeksForSkill(history, "technique")).toHaveLength(2);
  });

  it("rejects duplicate weeks and another player's week", () => {
    const history = createTrainingHistory(42, [week({ week: 100 })]);

    expect(() => addTrainingWeek(history, week({ week: 100 }))).toThrow(
      "Training week 100 already exists in the history."
    );
    expect(() => addTrainingWeek(history, week({ playerId: 43, week: 101 }))).toThrow(
      "Training week playerId must match the history playerId."
    );
  });
});

describe("skill-up detection", () => {
  it("detects a visible pop from snapshots even when the trained skill changes", () => {
    const history = createTrainingHistory(42, [
      week({
        week: 100,
        skill: "passing",
        skillLevelsBefore: levels(10, 8),
        skillLevelsAfter: levels(10, 8)
      }),
      week({
        week: 101,
        skill: "passing",
        skillLevelsBefore: levels(10, 8),
        skillLevelsAfter: levels(11, 8)
      })
    ]);

    expect(detectSkillUps(history)).toEqual([
      {
        playerId: 42,
        skill: "technique",
        fromLevel: 10,
        toLevel: 11,
        levelDelta: 1,
        week: 101
      }
    ]);
  });

  it("does not create an event without a visible increase", () => {
    const history = createTrainingHistory(42, [week({ week: 100 }), week({ week: 101 })]);

    expect(detectSkillUps(history)).toEqual([]);
  });

  it("marks a multi-level discontinuity as ambiguous", () => {
    const history = createTrainingHistory(42, [
      week({ week: 100, skillLevelsBefore: levels(10), skillLevelsAfter: levels(10) }),
      week({ week: 101, skillLevelsBefore: levels(10), skillLevelsAfter: levels(12) })
    ]);

    expect(buildSkillUpObservations(history)[0]).toMatchObject({
      fromLevel: 10,
      toLevel: 12,
      completeness: "left-censored",
      eligibleForTalentEstimation: false
    });
  });
});

describe("skill-up observations", () => {
  it("marks the first pop as left-censored and the next complete pop as eligible", () => {
    const history = createTrainingHistory(42, [
      week({
        week: 100,
        skillLevelsBefore: levels(10),
        skillLevelsAfter: levels(10),
        skillLevelBefore: 10,
        skillLevelAfter: 10
      }),
      week({
        week: 101,
        skillLevelsBefore: levels(10),
        skillLevelsAfter: levels(11),
        skillLevelBefore: 10,
        skillLevelAfter: 10
      }),
      week({
        week: 102,
        skillLevelsBefore: levels(11),
        skillLevelsAfter: levels(11),
        skillLevelBefore: 10,
        skillLevelAfter: 10
      }),
      week({
        week: 103,
        skill: "passing",
        skillLevelsBefore: levels(11, 8),
        skillLevelsAfter: levels(11, 8),
        skillLevelBefore: 11,
        skillLevelAfter: 11
      }),
      week({
        week: 104,
        skill: "technique",
        skillLevelsBefore: levels(11),
        skillLevelsAfter: levels(12),
        skillLevelBefore: 11,
        skillLevelAfter: 11
      })
    ]);

    const observations = buildSkillUpObservations(history);
    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({
      fromLevel: 10,
      toLevel: 11,
      startWeek: 100,
      popWeek: 101,
      completeness: "left-censored",
      eligibleForTalentEstimation: false
    });
    expect(observations[1]).toMatchObject({
      fromLevel: 11,
      toLevel: 12,
      startWeek: 101,
      popWeek: 104,
      accumulatedTrainingPoints: 186,
      weeksObserved: 3,
      weeksWithRelevantTraining: 2,
      completeness: "complete",
      eligibleForTalentEstimation: true,
      ageAtStart: 18,
      ageAtPop: 18
    });
  });

  it("adds zero points for weeks trained in another skill", () => {
    const history = createTrainingHistory(42, [
      week({
        week: 100,
        skill: "technique",
        officialMinutes: 90,
        skillLevelsBefore: levels(11),
        skillLevelsAfter: levels(11)
      }),
      week({
        week: 101,
        skill: "passing",
        officialMinutes: 90,
        skillLevelsBefore: levels(11, 8),
        skillLevelsAfter: levels(11, 8)
      }),
      week({
        week: 102,
        skill: "technique",
        officialMinutes: 90,
        skillLevelsBefore: levels(11),
        skillLevelsAfter: levels(11)
      }),
      week({
        week: 103,
        skill: "technique",
        officialMinutes: 90,
        skillLevelsBefore: levels(11),
        skillLevelsAfter: levels(12)
      })
    ]);

    expect(buildSkillUpObservations(history)[0]?.accumulatedTrainingPoints).toBe(279);
  });

  it("marks a missing week as incomplete", () => {
    const history = createTrainingHistory(42, [
      week({ week: 100, skillLevelsBefore: levels(10), skillLevelsAfter: levels(10) }),
      week({ week: 101, skillLevelsBefore: levels(10), skillLevelsAfter: levels(11) }),
      week({ week: 103, skillLevelsBefore: levels(11), skillLevelsAfter: levels(12) })
    ]);

    expect(buildSkillUpObservations(history)[1]).toMatchObject({
      completeness: "missing-weeks",
      eligibleForTalentEstimation: false
    });
  });
});

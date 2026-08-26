import { describe, expect, it } from "vitest";

import {
  createTrainingHistory,
  createTrainingWeek,
  deriveSkillChanges,
  estimateTalentFromEvidence,
  detectTalentEvidence,
  type TrainingWeekInput
} from "@atlas/domain";

const PLAYER_ID = 40098056;

function week(overrides: Partial<TrainingWeekInput> = {}): TrainingWeekInput {
  return {
    playerId: PLAYER_ID,
    gameWeek: 1201,
    season: 78,
    seasonWeek: 5,
    date: new Date("2026-08-06"),
    type: "pace",
    kind: "advanced",
    intensity: 100,
    age: 20,
    skills: { pace: 11 },
    skillsChange: { pace: 0, up: 0, down: 0 },
    ...overrides
  };
}

function historyWithPaceCycle(overrides: Record<number, Partial<TrainingWeekInput>> = {}) {
  const weeks = [
    week({
      gameWeek: 1200,
      seasonWeek: 4,
      skills: { pace: 11 },
      skillsChange: { pace: 1, up: 1, down: 0 }
    }),
    week({ gameWeek: 1201, seasonWeek: 5 }),
    week({ gameWeek: 1202, seasonWeek: 6 }),
    week({
      gameWeek: 1203,
      seasonWeek: 7,
      skills: { pace: 12 },
      skillsChange: { pace: 1, up: 1, down: 0 }
    })
  ].map((input) => ({ ...input, ...(overrides[input.gameWeek] ?? {}) }));

  return createTrainingHistory(PLAYER_ID, weeks.map(createTrainingWeek));
}

describe("official training report skill changes", () => {
  it("derives one event from after minus delta", () => {
    const changes = deriveSkillChanges({ pace: 11 }, { pace: 1, up: 1, down: 0 });

    expect(changes).toEqual([{ skill: "pace", before: 10, after: 11, delta: 1, direction: "up" }]);
  });

  it("keeps multiple events and skill drops, but omits zero deltas", () => {
    const changes = deriveSkillChanges(
      { pace: 11, passing: 9, technique: 16 },
      { pace: 1, passing: 1, technique: -1, up: 2, down: 1 }
    );

    expect(changes).toEqual([
      { skill: "pace", before: 10, after: 11, delta: 1, direction: "up" },
      { skill: "passing", before: 8, after: 9, delta: 1, direction: "up" },
      { skill: "technique", before: 17, after: 16, delta: -1, direction: "down" }
    ]);
  });
});

describe("clean pop to pop talent evidence", () => {
  it("accepts a complete advanced cycle", () => {
    const evidence = detectTalentEvidence(historyWithPaceCycle());

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      skill: "pace",
      fromLevel: 11,
      toLevel: 12,
      fromWeek: 1200,
      toWeek: 1203,
      trainingWeeks: 3,
      accumulatedTrainingPoints: 300,
      confidence: 1
    });
  });

  it("does not use the first observed pop as complete evidence", () => {
    const history = createTrainingHistory(
      PLAYER_ID,
      [
        week({ gameWeek: 1201 }),
        week({ gameWeek: 1202, skills: { pace: 11 }, skillsChange: { pace: 1, up: 1, down: 0 } })
      ].map(createTrainingWeek)
    );

    expect(detectTalentEvidence(history)).toEqual([]);
  });

  it("rejects formation and a changed training skill inside the interval", () => {
    expect(detectTalentEvidence(historyWithPaceCycle({ 1202: { kind: "formation" } }))).toEqual([]);
    expect(detectTalentEvidence(historyWithPaceCycle({ 1202: { type: "technique" } }))).toEqual([]);
  });

  it("allows a reported missing-training week with zero intensity", () => {
    const evidence = detectTalentEvidence(
      historyWithPaceCycle({ 1202: { kind: "missing", intensity: 0 } })
    );

    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.accumulatedTrainingPoints).toBe(200);
  });

  it("rejects an absent report instead of treating it as zero training", () => {
    const history = historyWithPaceCycle();
    const incompleteHistory = createTrainingHistory(
      PLAYER_ID,
      history.weeks.filter((trainingWeek) => trainingWeek.week !== 1202)
    );

    expect(detectTalentEvidence(incompleteHistory)).toEqual([]);
  });
});

describe("TalentEstimator", () => {
  it("returns unknown without evidence and confidence by evidence count", () => {
    expect(estimateTalentFromEvidence([])).toMatchObject({
      value: null,
      confidence: "unknown",
      evidenceCount: 0
    });

    const evidence = detectTalentEvidence(historyWithPaceCycle());
    expect(estimateTalentFromEvidence(evidence).confidence).toBe("low");
  });

  it("combines evidence and removes a clearly isolated outlier", () => {
    const evidence = detectTalentEvidence(historyWithPaceCycle());
    const estimate = estimateTalentFromEvidence([
      ...evidence.map((item) => ({ ...item, estimatedTalent: 8.1 })),
      { ...evidence[0]!, toWeek: 1210, estimatedTalent: 8.2 },
      { ...evidence[0]!, toWeek: 1220, estimatedTalent: 8.3 },
      { ...evidence[0]!, toWeek: 1230, estimatedTalent: 14.9 }
    ]);

    expect(estimate.confidence).toBe("high");
    expect(estimate.value).toBeCloseTo(8.2, 1);
    expect(estimate.evidenceCount).toBe(4);
  });
});

import { describe, expect, it } from "vitest";

import {
  createTrainingHistory,
  createTrainingWeek,
  type TalentEstimate,
  type TrainingWeekInput
} from "@atlas/domain";
import { estimateCurrentTrainingProgress } from "./index";

const PLAYER_ID = 42;

function trainingWeek(overrides: Partial<TrainingWeekInput>): TrainingWeekInput {
  return {
    playerId: PLAYER_ID,
    gameWeek: 1200,
    seasonWeek: 1,
    date: new Date("2026-11-01T00:00:00.000Z"),
    type: "passing",
    kind: "advanced",
    intensity: 100,
    age: 21,
    skills: { passing: 10, pace: 10 },
    skillsChange: { passing: 0, pace: 0, up: 0, down: 0 },
    ...overrides
  };
}

describe("estimateCurrentTrainingProgress", () => {
  it("uses the latest processed session when the current week is still unprocessed", () => {
    const history = createTrainingHistory(PLAYER_ID, [
      createTrainingWeek(
        trainingWeek({
          gameWeek: 1215,
          seasonWeek: 6,
          skillsChange: { passing: 1, pace: 0, up: 1, down: 0 }
        })
      ),
      createTrainingWeek(trainingWeek({ gameWeek: 1216, seasonWeek: 7 })),
      createTrainingWeek(trainingWeek({ gameWeek: 1217, seasonWeek: 8 })),
      createTrainingWeek(
        trainingWeek({
          gameWeek: 1218,
          seasonWeek: 9,
          type: "general",
          kind: "formation",
          intensity: 0,
          skillsChange: { passing: 0, pace: 0, up: 0, down: 0 }
        })
      )
    ]);
    const talent: TalentEstimate = {
      value: 1,
      confidence: "high",
      evidenceCount: 2,
      evidences: []
    };

    const progress = estimateCurrentTrainingProgress(history, 21, talent, 1218);

    expect(progress).toMatchObject({
      skill: "passing",
      accumulatedPoints: 200
    });
  });
});

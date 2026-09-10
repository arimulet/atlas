import { describe, expect, it } from "vitest";

import {
  buildWeeklyTrainingReport,
  createTrainingHistory,
  createTrainingWeek,
  type TrainingWeekInput
} from "@atlas/domain";

const PLAYER_ID = 40098056;

function trainingWeek(overrides: Partial<TrainingWeekInput> = {}) {
  return createTrainingWeek({
    playerId: PLAYER_ID,
    gameWeek: 1200,
    seasonWeek: 1,
    date: new Date("2026-08-01"),
    type: "technique",
    kind: "advanced",
    intensity: 100,
    age: 16,
    skills: { technique: 6 },
    skillsChange: { technique: 0, up: 0, down: 0 },
    ...overrides
  });
}

function history(weeks: ReturnType<typeof trainingWeek>[]) {
  return createTrainingHistory(PLAYER_ID, weeks);
}

function reportFor(
  weeks: ReturnType<typeof trainingWeek>[],
  options: { gameWeek?: number; talent?: number | null } = {}
) {
  return buildWeeklyTrainingReport({
    players: [{ history: history(weeks), talent: options.talent ?? 1 }],
    gameWeek: options.gameWeek
  });
}

describe("weekly training intelligence", () => {
  it("builds a normal week without a skill-up", () => {
    const report = reportFor([
      trainingWeek({ gameWeek: 1200, skills: { technique: 6 } }),
      trainingWeek({ gameWeek: 1201, skills: { technique: 6 }, skillLevelAfter: 6 })
    ]);

    expect(report.players[0]).toMatchObject({
      gameWeek: 1201,
      skill: { previousLevel: 6, currentLevel: 6, skillUp: false },
      trainingPoints: { earned: 100 }
    });
  });

  it("confirms a skill-up from the current report skillsChange", () => {
    const report = reportFor([
      trainingWeek({
        gameWeek: 1200,
        skills: { technique: 6 },
        skillsChange: { technique: 1, up: 1, down: 0 }
      })
    ]);

    expect(report.players[0]?.skill).toEqual({
      previousLevel: 5,
      currentLevel: 6,
      skillUp: true
    });
  });

  it("does not infer a training skill-up from snapshots when skillsChange is unchanged", () => {
    const report = reportFor([
      trainingWeek({ gameWeek: 1200, skills: { technique: 6 } }),
      trainingWeek({ gameWeek: 1201, skills: { technique: 7 } })
    ]);

    expect(report.players[0]?.skill).toEqual({
      previousLevel: 6,
      currentLevel: 7,
      skillUp: false
    });
  });

  it("uses the official intensity when it is below 100%", () => {
    const report = reportFor([
      trainingWeek({
        gameWeek: 1200,
        intensity: 75,
        skills: { technique: 6 },
        skillsChange: { technique: 1, up: 1, down: 0 }
      })
    ]);

    expect(report.players[0]?.trainingPoints.earned).toBe(75);
  });

  it("keeps advanced and formation training in the weekly summary", () => {
    const advanced = trainingWeek({ playerId: PLAYER_ID, gameWeek: 1200, kind: "advanced" });
    const formation = trainingWeek({
      playerId: PLAYER_ID + 1,
      gameWeek: 1200,
      kind: "formation",
      skills: { technique: 6 }
    });

    const report = buildWeeklyTrainingReport({
      players: [
        { history: createTrainingHistory(PLAYER_ID, [advanced]), talent: 1 },
        { history: createTrainingHistory(PLAYER_ID + 1, [formation]), talent: 1 }
      ]
    });

    expect(report.summary).toEqual({
      trainedPlayers: 2,
      advancedPlayers: 1,
      formationPlayers: 1,
      skillUps: 0,
      averageIntensity: 100
    });
  });

  it("accumulates progress only from the trained skill over several weeks", () => {
    const report = reportFor([
      trainingWeek({
        gameWeek: 1200,
        skills: { technique: 6 },
        skillsChange: { technique: 1, up: 1, down: 0 }
      }),
      trainingWeek({ gameWeek: 1201, intensity: 20, skills: { technique: 6 } }),
      trainingWeek({ gameWeek: 1202, intensity: 20, skills: { technique: 6 } })
    ]);

    expect(report.players[0]?.trainingPoints.estimatedProgress).toBeCloseTo(40 / 51.418, 5);
  });

  it("does not reuse progress when the trained skill changes", () => {
    const report = reportFor(
      [
        trainingWeek({
          gameWeek: 1200,
          skills: { pace: 6, technique: 6 },
          type: "pace",
          skill: "pace",
          skillsChange: { pace: 1, up: 1, down: 0 }
        }),
        trainingWeek({ gameWeek: 1201, skills: { pace: 6, technique: 6 }, type: "technique" })
      ],
      { gameWeek: 1201 }
    );

    expect(report.players[0]?.trainingPoints.estimatedProgress).toBeNull();
  });

  it("returns null progress for a first observation without a known skill-up", () => {
    const report = reportFor([trainingWeek({ gameWeek: 1200 })]);

    expect(report.players[0]?.trainingPoints).toMatchObject({
      estimatedProgress: null,
      remainingToNextLevel: null,
      estimatedWeeksToNextLevel: null
    });
  });

  it("returns null progress when the accumulation history has a gap", () => {
    const report = reportFor([
      trainingWeek({
        gameWeek: 1200,
        skills: { technique: 6 },
        skillsChange: { technique: 1, up: 1, down: 0 }
      }),
      trainingWeek({ gameWeek: 1202, skills: { technique: 6 } })
    ]);

    expect(report.players[0]?.trainingPoints.estimatedProgress).toBeNull();
  });

  it("calculates estimated weeks using the current weekly intensity", () => {
    const report = reportFor([
      trainingWeek({
        gameWeek: 1200,
        skills: { technique: 6 },
        skillsChange: { technique: 1, up: 1, down: 0 }
      }),
      trainingWeek({ gameWeek: 1201, intensity: 25, skills: { technique: 6 } })
    ]);
    const player = report.players[0]!;

    expect(player.trainingPoints.remainingToNextLevel).toBeCloseTo(51.418 - 25, 5);
    expect(player.trainingPoints.estimatedWeeksToNextLevel).toBeCloseTo((51.418 - 25) / 25, 5);
  });

  it("never returns negative remaining training points", () => {
    const report = reportFor([
      trainingWeek({
        gameWeek: 1200,
        skills: { technique: 6 },
        skillsChange: { technique: 1, up: 1, down: 0 }
      }),
      trainingWeek({ gameWeek: 1201, intensity: 100, skills: { technique: 6 } })
    ]);

    expect(report.players[0]?.trainingPoints.remainingToNextLevel).toBe(0);
    expect(report.players[0]?.trainingPoints.estimatedProgress).toBe(1);
  });

  it("excludes missing training reports from the weekly summary", () => {
    const report = buildWeeklyTrainingReport({
      players: [
        {
          history: history([trainingWeek({ gameWeek: 1200, kind: "missing", intensity: 0 })]),
          talent: 1
        }
      ]
    });

    expect(report.players).toHaveLength(0);
    expect(report.summary).toMatchObject({
      trainedPlayers: 0,
      advancedPlayers: 0,
      formationPlayers: 0,
      skillUps: 0,
      averageIntensity: 0
    });
  });

  it("starts a new progress cycle when the current week contains the skill-up", () => {
    const report = reportFor([
      trainingWeek({
        gameWeek: 1200,
        skills: { technique: 6 },
        skillsChange: { technique: 1, up: 1, down: 0 }
      })
    ]);

    expect(report.players[0]?.trainingPoints.estimatedProgress).toBe(0);
    expect(report.players[0]?.trainingPoints.remainingToNextLevel).toBeCloseTo(51.418, 10);
    expect(report.players[0]?.trainingPoints.estimatedWeeksToNextLevel).toBeCloseTo(0.51418, 10);
  });
});

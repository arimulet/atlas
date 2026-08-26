import { describe, expect, it } from "vitest";

import {
  generatePlayerTrainingPath,
  projectDevelopment,
  type DevelopmentProjectionContext,
  type DevelopmentPlayer,
  type PlayerDevelopmentTarget,
  type PlayerTrainingPath,
  type TrainingPathContext
} from "@atlas/domain";

type TestPlayerOverrides = Partial<Omit<DevelopmentPlayer, "age">> & { age?: number };

function player(overrides: TestPlayerOverrides = {}): DevelopmentPlayer & { age: number } {
  return {
    playerId: 42,
    age: 18,
    formation: "DEF",
    skills: {
      pace: 10,
      technique: 9,
      passing: 7,
      keeper: 1,
      defender: 12,
      playmaker: 8,
      striker: 3,
      stamina: 8
    },
    ...overrides
  };
}

function target(
  targetSkills: PlayerDevelopmentTarget["targetSkills"],
  overrides: Partial<PlayerDevelopmentTarget> = {}
): PlayerDevelopmentTarget {
  return {
    playerId: 42,
    profile: "defender",
    source: "automatic",
    targetSkills,
    ...overrides
  };
}

function projectionContext(
  targetSkills: PlayerDevelopmentTarget["targetSkills"],
  overrides: Partial<DevelopmentProjectionContext> = {}
): DevelopmentProjectionContext {
  const currentPlayer = player();
  const currentTarget = target(targetSkills);
  const pathContext: TrainingPathContext = {
    player: currentPlayer,
    target: currentTarget,
    expectedWeeklyTrainingPoints: 100,
    talent: { value: 1, confidence: "high", evidenceCount: 3, evidences: [] }
  };
  const path = generatePlayerTrainingPath(pathContext);

  return {
    player: currentPlayer,
    target: currentTarget,
    path,
    currentGameWeek: 1204,
    currentDate: new Date("2026-08-05T00:00:00.000Z"),
    talent: pathContext.talent,
    trainingAssumptions: {
      trainingKind: "advanced",
      expectedIntensity: 100,
      assumeContinuousTraining: true
    },
    ...overrides
  };
}

function oneStepPath(overrides: Partial<PlayerTrainingPath> = {}): PlayerTrainingPath {
  return {
    playerId: 42,
    profile: "defender",
    steps: [
      {
        order: 1,
        skill: "defender",
        fromLevel: 12,
        toLevel: 13,
        estimatedTrainingPoints: 80,
        developmentValue: 0.3,
        priority: "primary",
        reason: []
      }
    ],
    milestones: [
      { step: 1, type: "skill_target_completed", skill: "defender" },
      { step: 1, type: "primary_skills_completed" },
      { step: 1, type: "development_target_completed" }
    ],
    totals: { skillUps: 1, estimatedTrainingPoints: 80 },
    completed: true,
    confidence: "high",
    ...overrides
  };
}

describe("Development Projection & Timeline", () => {
  it("projects a path with one step", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    );

    expect(projection.steps).toHaveLength(1);
    expect(projection.steps[0]).toMatchObject({
      order: 1,
      skill: "defender",
      fromLevel: 12,
      toLevel: 13
    });
  });

  it("projects multiple steps with continuous cumulative time", () => {
    const projection = projectDevelopment(
      projectionContext([
        { skill: "defender", targetLevel: 14, priority: "primary" },
        { skill: "pace", targetLevel: 12, priority: "secondary" }
      ])
    );

    expect(projection.steps.length).toBeGreaterThan(1);
    expect(projection.steps[1]!.cumulativeWeeks).toBeGreaterThan(
      projection.steps[0]!.cumulativeWeeks!
    );
  });

  it("uses remaining current-level progress for the first step", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        currentTrainingProgress: {
          skill: "defender",
          remainingToNextLevel: 10,
          estimatedProgress: 0.8,
          confidence: "high"
        }
      })
    );

    expect(projection.steps[0]?.estimatedTrainingPoints).toBe(10);
    expect(projection.warnings).not.toContain("unknown_current_sublevel");
  });

  it("marks the first step low confidence when sublevel progress is unknown", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    );

    expect(projection.steps[0]?.confidence).toBe("low");
    expect(projection.warnings).toContain("unknown_current_sublevel");
  });

  it("updates estimated age between steps", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 14, priority: "primary" }], {
        currentTrainingProgress: { skill: "defender", remainingToNextLevel: 1 }
      })
    );

    expect(projection.steps[1]?.estimatedAge).toBeGreaterThan(projection.steps[0]!.estimatedAge!);
  });

  it("uses an available birth date without inventing one", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        birthDate: new Date("2008-08-05T00:00:00.000Z")
      })
    );

    expect(projection.steps[0]?.estimatedAge).toBeGreaterThan(18);
  });

  it("reapplies the age factor to future training costs", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 14, priority: "primary" }], {
        currentTrainingProgress: { skill: "defender", remainingToNextLevel: 1 }
      })
    );

    expect(projection.steps[1]?.estimatedTrainingPoints).toBeGreaterThan(
      projection.steps[0]!.estimatedTrainingPoints
    );
  });

  it("crosses a season boundary using game week arithmetic", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        currentGameWeek: 1210
      })
    );

    expect(projection.steps[0]!.estimatedGameWeek).toBeGreaterThan(1210);
  });

  it("derives game week and date from the current temporal state", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        currentGameWeek: 1204,
        currentDate: new Date("2026-08-05T00:00:00.000Z")
      })
    );
    const step = projection.steps[0]!;

    expect(step.estimatedGameWeek).toBe(Math.round(1204 + step.cumulativeWeeks!));
    expect(step.estimatedDate?.getTime()).toBeGreaterThan(
      new Date("2026-08-05T00:00:00.000Z").getTime()
    );
  });

  it("projects skill, primary and final milestones", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    );

    expect(projection.milestones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "skill_target_completed", skill: "defender" }),
        expect.objectContaining({ type: "primary_skills_completed" }),
        expect.objectContaining({ type: "development_target_completed" })
      ])
    );
  });

  it("projects final completion time, date, game week and age", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    );

    expect(projection.projectionStatus).toBe("projected");
    expect(projection.completion.estimatedWeeks).toBeGreaterThan(0);
    expect(projection.completion.estimatedGameWeek).toBeGreaterThan(1204);
    expect(projection.completion.estimatedAge).toBeGreaterThan(18);
    expect(projection.completion.estimatedDate).toBeInstanceOf(Date);
  });

  it("supports advanced assumptions", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        trainingAssumptions: {
          trainingKind: "advanced",
          expectedIntensity: 100,
          assumeContinuousTraining: true
        }
      })
    );

    expect(projection.assumptions.trainingKind).toBe("advanced");
    expect(projection.warnings).toContain("advanced_training_assumed");
  });

  it("supports formation assumptions with their lower effectiveness", () => {
    const advanced = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    );
    const formation = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        trainingAssumptions: {
          trainingKind: "formation",
          expectedIntensity: 100,
          assumeContinuousTraining: true
        }
      })
    );

    expect(formation.assumptions.trainingKind).toBe("formation");
    expect(formation.steps[0]!.estimatedWeeks).toBeCloseTo(advanced.steps[0]!.estimatedWeeks! * 2);
  });

  it("projects lower intensity more slowly", () => {
    const fullIntensity = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    );
    const lowerIntensity = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        trainingAssumptions: {
          trainingKind: "advanced",
          expectedIntensity: 50,
          assumeContinuousTraining: true
        }
      })
    );

    expect(lowerIntensity.steps[0]!.estimatedWeeks).toBeCloseTo(
      fullIntensity.steps[0]!.estimatedWeeks! * 2
    );
  });

  it("handles missing talent without producing an invalid timeline", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        talent: null
      })
    );

    expect(projection.steps).toHaveLength(1);
    expect(projection.confidence).toBe("low");
    expect(projection.warnings).toContain("low_talent_confidence");
  });

  it("lowers confidence for low-confidence talent estimates", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        talent: { value: 1, confidence: "low", evidenceCount: 1, evidences: [] }
      })
    );

    expect(projection.confidence).toBe("low");
    expect(projection.warnings).toContain("low_talent_confidence");
  });

  it("decays confidence on long-term projections", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        trainingAssumptions: {
          trainingKind: "advanced",
          expectedIntensity: 2,
          assumeContinuousTraining: true
        },
        maxProjectionWeeks: 100
      })
    );

    expect(projection.warnings).toContain("long_term_projection");
    expect(projection.confidence).toBe("low");
  });

  it("returns a partial projection when the horizon is exceeded", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        maxProjectionWeeks: 0.5
      })
    );

    expect(projection.projectionStatus).toBe("partial");
    expect(projection.warnings).toContain("projection_horizon_exceeded");
    expect(projection.completion.estimatedWeeks).toBeNull();
  });

  it("marks invalid training points unavailable without Infinity or NaN", () => {
    const projection = projectDevelopment({
      ...projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }]),
      path: oneStepPath({
        steps: [
          {
            ...oneStepPath().steps[0]!,
            estimatedTrainingPoints: Number.NaN
          }
        ]
      })
    });

    expect(projection.projectionStatus).toBe("unavailable");
    expect(projection.warnings).toContain("invalid_training_points");
    expect(projection.steps.every((step) => Object.values(step).every(isFiniteValue))).toBe(true);
    expect(projection.completion.estimatedWeeks).toBeNull();
  });

  it("is unavailable when assumptions produce no weekly training points", () => {
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        trainingAssumptions: {
          trainingKind: "advanced",
          expectedIntensity: 0,
          assumeContinuousTraining: true
        }
      })
    );

    expect(projection.projectionStatus).toBe("unavailable");
    expect(projection.steps).toEqual([]);
    expect(projection.steps.some((step) => !Number.isFinite(step.estimatedWeeks))).toBe(false);
  });

  it("is deterministic for identical projection contexts", () => {
    const context = projectionContext([
      { skill: "defender", targetLevel: 14, priority: "primary" },
      { skill: "pace", targetLevel: 12, priority: "secondary" }
    ]);

    expect(projectDevelopment(context)).toEqual(projectDevelopment(context));
  });

  it("projects an already-completed target at the current time", () => {
    const currentPlayer = player({ skills: { defender: 13 } });
    const currentTarget = target([{ skill: "defender", targetLevel: 13, priority: "primary" }]);
    const path = generatePlayerTrainingPath({ player: currentPlayer, target: currentTarget });
    const projection = projectDevelopment({
      player: currentPlayer,
      target: currentTarget,
      path,
      currentGameWeek: 1204,
      currentDate: new Date("2026-08-05T00:00:00.000Z"),
      talent: null
    });

    expect(projection.steps).toEqual([]);
    expect(projection.completion.estimatedWeeks).toBe(0);
    expect(projection.milestones).toContainEqual(
      expect.objectContaining({ type: "development_target_completed", step: 0 })
    );
  });

  it("marks an incomplete path as partial", () => {
    const currentTarget = target([{ skill: "defender", targetLevel: 13, priority: "primary" }]);
    const projection = projectDevelopment({
      ...projectionContext(currentTarget.targetSkills),
      path: oneStepPath({ steps: [], completed: false, milestones: [] })
    });

    expect(projection.projectionStatus).toBe("partial");
    expect(projection.warnings).toContain("path_incomplete");
  });

  it("keeps assumptions exposed in the result", () => {
    const assumptions = {
      trainingKind: "formation" as const,
      expectedIntensity: 75,
      assumeContinuousTraining: false
    };
    const projection = projectDevelopment(
      projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        trainingAssumptions: assumptions
      })
    );

    expect(projection.assumptions).toEqual(assumptions);
    expect(projection.warnings).toContain("continuous_training_not_assumed");
  });

  it("uses explicit defaults when assumptions are omitted", () => {
    const projection = projectDevelopment({
      ...projectionContext([{ skill: "defender", targetLevel: 13, priority: "primary" }]),
      trainingAssumptions: undefined
    });

    expect(projection.assumptions).toEqual({
      trainingKind: "advanced",
      expectedIntensity: 100,
      assumeContinuousTraining: true
    });
    expect(projection.warnings).toContain("intensity_assumed");
  });
});

function isFiniteValue(value: unknown): boolean {
  return value instanceof Date || typeof value !== "number" || Number.isFinite(value);
}

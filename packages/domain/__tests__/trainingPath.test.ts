import { describe, expect, it } from "vitest";

import {
  DEVELOPMENT_PRIORITY_WEIGHTS,
  MAX_DEVELOPMENT_PATH_STEPS,
  createDevelopmentSimulationState,
  generateNextTrainingCandidates,
  generatePlayerTrainingPath,
  selectBestTrainingCandidate,
  type DevelopmentPlayer,
  type DevelopmentSimulationState,
  type PlayerDevelopmentTarget,
  type TrainingPathCandidate,
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
    profile: "central_defender",
    source: "automatic",
    targetSkills,
    ...overrides
  };
}

function context(
  targetSkills: PlayerDevelopmentTarget["targetSkills"],
  overrides: Partial<TrainingPathContext> = {}
): TrainingPathContext {
  return {
    player: player(),
    target: target(targetSkills),
    expectedWeeklyTrainingPoints: 100,
    ...overrides
  };
}

function candidate(overrides: Partial<TrainingPathCandidate> = {}): TrainingPathCandidate {
  return {
    skill: "pace",
    fromLevel: 10,
    toLevel: 11,
    requiredTrainingPoints: 100,
    expectedWeeklyTrainingPoints: 100,
    estimatedWeeks: 1,
    estimatedAgeAtStep: 18,
    targetPriority: "primary",
    developmentReturnScore: 0.5,
    developmentValue: 0.4,
    pathScore: DEVELOPMENT_PRIORITY_WEIGHTS.primary * 0.5,
    reason: [],
    ...overrides
  };
}

describe("Training Path Generator", () => {
  it("generates one skill-up at a time for a single-skill target", () => {
    const path = generatePlayerTrainingPath(
      context([{ skill: "defender", targetLevel: 14, priority: "primary" }])
    );

    expect(path.steps.map((step) => [step.fromLevel, step.toLevel])).toEqual([
      [12, 13],
      [13, 14]
    ]);
  });

  it("interleaves candidates from multiple target skills dynamically", () => {
    const path = generatePlayerTrainingPath(
      context([
        { skill: "defender", targetLevel: 14, priority: "primary" },
        { skill: "pace", targetLevel: 12, priority: "primary" },
        { skill: "technique", targetLevel: 10, priority: "secondary" }
      ])
    );

    expect(path.steps).toHaveLength(5);
    expect(new Set(path.steps.map((step) => step.skill)).size).toBeGreaterThan(1);
  });

  it("ignores skills that already reached their target", () => {
    const path = generatePlayerTrainingPath(
      context([
        { skill: "defender", targetLevel: 12, priority: "primary" },
        { skill: "pace", targetLevel: 11, priority: "secondary" }
      ])
    );

    expect(path.steps.every((step) => step.skill === "pace")).toBe(true);
  });

  it("never generates a level above the target", () => {
    const path = generatePlayerTrainingPath(
      context([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    );

    expect(path.steps.at(-1)).toMatchObject({ fromLevel: 12, toLevel: 13 });
    expect(path.steps.some((step) => step.toLevel > 13)).toBe(false);
  });

  it("usually favors a primary skill when returns are comparable", () => {
    const path = generatePlayerTrainingPath(
      context([
        { skill: "defender", targetLevel: 13, priority: "primary" },
        { skill: "pace", targetLevel: 11, priority: "secondary" }
      ])
    );

    expect(path.steps[0]?.priority).toBe("primary");
  });

  it("can advance a secondary skill when its marginal return is clearly better", () => {
    const path = generatePlayerTrainingPath(
      context(
        [
          { skill: "defender", targetLevel: 18, priority: "primary" },
          { skill: "pace", targetLevel: 5, priority: "secondary" }
        ],
        { player: player({ skills: { defender: 17, pace: 4 } }) }
      )
    );

    expect(path.steps[0]?.skill).toBe("pace");
  });

  it("recalculates candidates after the simulated skill-up", () => {
    const pathContext = context([{ skill: "defender", targetLevel: 14, priority: "primary" }]);
    const state = createDevelopmentSimulationState(pathContext);
    const first = generateNextTrainingCandidates(pathContext, state)[0];

    expect(first).toBeDefined();
    state.skills.defender = 13;
    state.stepsCompleted = 1;
    const next = generateNextTrainingCandidates(pathContext, state)[0];

    expect(next?.fromLevel).toBe(13);
    expect(next?.requiredTrainingPoints).toBeGreaterThan(first?.requiredTrainingPoints ?? 0);
  });

  it("exposes increasing marginal cost as a skill level rises", () => {
    const pathContext = context([{ skill: "defender", targetLevel: 14, priority: "primary" }]);
    const state = createDevelopmentSimulationState(pathContext);
    const first = generateNextTrainingCandidates(pathContext, state)[0]!;

    state.skills.defender = first.toLevel;
    state.stepsCompleted = 1;
    const second = generateNextTrainingCandidates(pathContext, state)[0]!;

    expect(second.requiredTrainingPoints).toBeGreaterThan(first.requiredTrainingPoints);
  });

  it("gives different paths to players with different current skills", () => {
    const targetSkills = [
      { skill: "defender" as const, targetLevel: 14, priority: "primary" as const },
      { skill: "pace" as const, targetLevel: 14, priority: "primary" as const }
    ];
    const first = generatePlayerTrainingPath(context(targetSkills));
    const second = generatePlayerTrainingPath(
      context(targetSkills, { player: player({ skills: { defender: 8, pace: 13 } }) })
    );

    expect(first.steps[0]?.skill).not.toBe(second.steps[0]?.skill);
  });

  it("advances the simulated age as estimated weeks accumulate", () => {
    const pathContext = context([{ skill: "defender", targetLevel: 14, priority: "primary" }]);
    const state = createDevelopmentSimulationState(pathContext);
    const first = generateNextTrainingCandidates(pathContext, state)[0]!;

    state.skills.defender = first.toLevel;
    state.stepsCompleted = 1;
    state.estimatedAge = first.estimatedAgeAtStep;
    const next = generateNextTrainingCandidates(pathContext, state)[0]!;

    expect(next.estimatedAgeAtStep).toBeGreaterThan(first.estimatedAgeAtStep);
  });

  it("uses talent in the existing training cost and return model", () => {
    const withoutTalent = generateNextTrainingCandidates(
      context([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    )[0]!;
    const withTalent = generateNextTrainingCandidates(
      context([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        talent: { value: 0.7, confidence: "high", evidenceCount: 3, evidences: [] }
      })
    )[0]!;

    expect(withTalent.requiredTrainingPoints).toBeLessThan(withoutTalent.requiredTrainingPoints);
    expect(withTalent.developmentReturnScore).toBeGreaterThan(withoutTalent.developmentReturnScore);
  });

  it("generates a path without talent and lowers confidence", () => {
    const path = generatePlayerTrainingPath(
      context([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    );

    expect(path.completed).toBe(true);
    expect(path.confidence).toBe("low");
  });

  it("is deterministic for the same context", () => {
    const pathContext = context([
      { skill: "defender", targetLevel: 14, priority: "primary" },
      { skill: "pace", targetLevel: 12, priority: "secondary" }
    ]);

    expect(generatePlayerTrainingPath(pathContext)).toEqual(
      generatePlayerTrainingPath(pathContext)
    );
  });

  it("uses the explicit stable tie-breaker", () => {
    const best = selectBestTrainingCandidate([
      candidate({ skill: "pace" }),
      candidate({ skill: "defender" })
    ]);

    expect(best?.skill).toBe("pace");
  });

  it("creates skill and target milestones", () => {
    const path = generatePlayerTrainingPath(
      context([
        { skill: "defender", targetLevel: 13, priority: "primary" },
        { skill: "pace", targetLevel: 11, priority: "secondary" }
      ])
    );

    expect(path.milestones).toContainEqual({
      step: 1,
      type: "skill_target_completed",
      skill: "defender"
    });
    expect(path.milestones).toContainEqual({
      step: 2,
      type: "development_target_completed"
    });
  });

  it("marks primary skills as completed independently of supporting skills", () => {
    const path = generatePlayerTrainingPath(
      context([
        { skill: "defender", targetLevel: 13, priority: "primary" },
        { skill: "pace", targetLevel: 11, priority: "supporting" }
      ])
    );

    expect(path.milestones).toContainEqual({ step: 1, type: "primary_skills_completed" });
  });

  it("marks a fully reached target as completed", () => {
    const path = generatePlayerTrainingPath(
      context([{ skill: "defender", targetLevel: 13, priority: "primary" }], {
        player: player({ skills: { defender: 13 } })
      })
    );

    expect(path.completed).toBe(true);
    expect(path.milestones).toEqual([]);
  });

  it("returns an empty path when the target is already complete", () => {
    const path = generatePlayerTrainingPath(
      context([{ skill: "defender", targetLevel: 12, priority: "primary" }])
    );

    expect(path.steps).toEqual([]);
    expect(path.totals).toEqual({ skillUps: 0, estimatedTrainingPoints: 0 });
  });

  it("rejects duplicate target skills", () => {
    expect(() =>
      generatePlayerTrainingPath(
        context([
          { skill: "defender", targetLevel: 13, priority: "primary" },
          { skill: "defender", targetLevel: 14, priority: "secondary" }
        ])
      )
    ).toThrow(/duplicate skill/);
  });

  it("rejects target levels outside the Training Domain range", () => {
    expect(() =>
      generatePlayerTrainingPath(
        context([{ skill: "defender", targetLevel: 19, priority: "primary" }])
      )
    ).toThrow(/Invalid target level/);
  });

  it("protects candidate generation after the maximum path length", () => {
    const pathContext = context([{ skill: "defender", targetLevel: 14, priority: "primary" }]);
    const state: DevelopmentSimulationState = {
      ...createDevelopmentSimulationState(pathContext),
      stepsCompleted: MAX_DEVELOPMENT_PATH_STEPS
    };

    expect(generateNextTrainingCandidates(pathContext, state)).toEqual([]);
  });

  it("reports totals equal to the generated steps", () => {
    const path = generatePlayerTrainingPath(
      context([
        { skill: "defender", targetLevel: 13, priority: "primary" },
        { skill: "pace", targetLevel: 11, priority: "secondary" }
      ])
    );

    expect(path.totals.skillUps).toBe(path.steps.length);
    expect(path.totals.estimatedTrainingPoints).toBe(
      path.steps.reduce((total, step) => total + step.estimatedTrainingPoints, 0)
    );
  });

  it("attaches semantic reasons that match each generated step", () => {
    const path = generatePlayerTrainingPath(
      context([{ skill: "defender", targetLevel: 13, priority: "primary" }])
    );

    expect(path.steps[0]?.reason).toContainEqual({
      type: "primary_target_skill",
      skill: "defender"
    });
    expect(path.steps.at(-1)?.reason).toContainEqual({
      type: "completes_target_skill",
      skill: "defender"
    });
  });
});

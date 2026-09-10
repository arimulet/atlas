import { describe, expect, it } from "vitest";

import {
  compareAdvancedAndFormationMarketValue,
  compareTrainingPathMarketValue,
  estimatePlayerMarketValue,
  projectMarketValueAtHorizon,
  projectPlayerMarketValue,
  type DevelopmentProjectionStep,
  type FutureMarketValueContext,
  type PlayerDevelopmentPlan,
  type PlayerDevelopmentProjection,
  type PlayerMarketValuePlayer,
  type PlayerTrainingPath
} from "@atlas/domain";

const player: PlayerMarketValuePlayer = {
  playerId: 77,
  age: 18.4,
  formation: "DEF",
  profile: "defender",
  skills: {
    stamina: 8,
    pace: 11,
    technique: 10,
    passing: 8,
    keeper: 1,
    defender: 12,
    playmaker: 9,
    striker: 3
  }
};

function plan(): PlayerDevelopmentPlan {
  const target: PlayerDevelopmentPlan["target"] = {
    playerId: player.playerId,
    profile: "defender",
    targetSkills: [
      { skill: "defender", targetLevel: 14, priority: "primary" },
      { skill: "pace", targetLevel: 12, priority: "secondary" }
    ],
    source: "manual"
  };

  return {
    suggestion: {
      profile: "defender",
      confidence: "high",
      reasons: []
    },
    idealTarget: target,
    target,
    gap: {
      playerId: player.playerId,
      profile: "defender",
      totalGap: 3,
      progress: 0.7,
      skills: [
        {
          skill: "defender",
          currentLevel: 12,
          targetLevel: 14,
          levelsRemaining: 2,
          priority: "primary",
          completed: false
        },
        {
          skill: "pace",
          currentLevel: 11,
          targetLevel: 12,
          levelsRemaining: 1,
          priority: "secondary",
          completed: false
        }
      ]
    }
  };
}

function step(
  order: number,
  skill: "defender" | "pace",
  fromLevel: number,
  toLevel: number,
  weeks: number,
  age: number
): DevelopmentProjectionStep {
  return {
    order,
    skill,
    fromLevel,
    toLevel,
    estimatedTrainingPoints: weeks * 100,
    estimatedWeeks: weeks,
    cumulativeWeeks: weeks,
    estimatedGameWeek: 30 + Math.round(weeks),
    estimatedDate: new Date(`2026-09-${String(1 + Math.round(weeks)).padStart(2, "0")}T00:00:00.000Z`),
    estimatedAge: age,
    confidence: "high"
  };
}

function projection(steps: DevelopmentProjectionStep[]): PlayerDevelopmentProjection {
  const last = steps.at(-1);
  return {
    playerId: player.playerId,
    profile: "defender",
    generatedAtGameWeek: 20,
    generatedAtDate: new Date("2026-08-20T00:00:00.000Z"),
    steps,
    milestones: [
      {
        type: "primary_skills_completed",
        step: steps.length,
        cumulativeWeeks: last?.cumulativeWeeks ?? 0,
        estimatedGameWeek: last?.estimatedGameWeek ?? 20,
        estimatedDate: last?.estimatedDate ?? new Date("2026-08-20T00:00:00.000Z"),
        estimatedAge: last?.estimatedAge ?? player.age!,
        confidence: "high"
      },
      {
        type: "development_target_completed",
        step: steps.length,
        cumulativeWeeks: last?.cumulativeWeeks ?? 0,
        estimatedGameWeek: last?.estimatedGameWeek ?? 20,
        estimatedDate: last?.estimatedDate ?? new Date("2026-08-20T00:00:00.000Z"),
        estimatedAge: last?.estimatedAge ?? player.age!,
        confidence: "high"
      }
    ],
    completion: {
      estimatedWeeks: last?.cumulativeWeeks ?? 0,
      estimatedGameWeek: last?.estimatedGameWeek ?? 20,
      estimatedDate: last?.estimatedDate ?? new Date("2026-08-20T00:00:00.000Z"),
      estimatedAge: last?.estimatedAge ?? player.age!
    },
    confidence: "high",
    assumptions: {
      trainingKind: "advanced",
      expectedIntensity: 100,
      assumeContinuousTraining: true
    },
    projectionStatus: "projected",
    warnings: []
  };
}

function path(steps: DevelopmentProjectionStep[]): PlayerTrainingPath {
  return {
    playerId: player.playerId,
    profile: "defender",
    steps: steps.map((item) => ({
      order: item.order,
      skill: item.skill,
      fromLevel: item.fromLevel,
      toLevel: item.toLevel,
      priority: item.skill === "defender" ? "primary" : "secondary",
      estimatedTrainingPoints: item.estimatedTrainingPoints,
      developmentValue: 1,
      reason: []
    })),
    milestones: [],
    totals: {
      skillUps: steps.length,
      estimatedTrainingPoints: steps.reduce((sum, item) => sum + item.estimatedTrainingPoints, 0)
    },
    completed: true,
    confidence: "high"
  };
}

function context(overrides: Partial<FutureMarketValueContext> = {}): FutureMarketValueContext {
  const steps = [
    step(1, "defender", 12, 13, 2, 18.55),
    step(2, "pace", 11, 12, 5, 18.8),
    step(3, "defender", 13, 14, 10, 19.3)
  ];
  steps[1]!.cumulativeWeeks = 7;
  steps[1]!.estimatedGameWeek = 37;
  steps[2]!.cumulativeWeeks = 17;
  steps[2]!.estimatedGameWeek = 47;
  const currentPlan = plan();
  const currentPath = path(steps);
  const currentProjection = projection(steps);
  return {
    player,
    developmentPlan: currentPlan,
    path: currentPath,
    projection: currentProjection,
    ...overrides
  };
}

describe("future player market value", () => {
  it("reconstructs immutable future states and accumulates skill-ups", () => {
    const result = projectPlayerMarketValue(context());

    expect(result.points.map((point) => point.skills.defender)).toEqual([13, 13, 14]);
    expect(result.points.map((point) => point.skills.pace)).toEqual([11, 12, 12]);
    expect(player.skills.defender).toBe(12);
    expect(result.points[0]?.estimatedAge).toBe(18.55);
  });

  it("calculates gains from current, previous step, and per week", () => {
    const result = projectPlayerMarketValue(context());
    const first = result.points[0]!;
    const evaluation = result.roi.stepEvaluations[0]!;

    expect(first.valueGainFromCurrent).toBe(first.marketValue!.expected - result.current.calibratedValue.expected);
    expect(first.valueGainFromPrevious).toBe(first.valueGainFromCurrent);
    expect(evaluation.valueGain).toBe(first.valueGainFromPrevious);
    expect(evaluation.valueGainPerWeek).toBe(evaluation.valueGain! / evaluation.estimatedWeeks!);
  });

  it("uses the fundamental model again for future states and keeps valid ranges", () => {
    const result = projectPlayerMarketValue(context());
    const direct = estimatePlayerMarketValue({
      player: { ...player, age: 18.55, skills: { ...player.skills, defender: 13 } },
      developmentProfile: "defender",
      developmentPlan: plan()
    });

    expect(result.points[0]!.marketValue!.expected).toBe(direct.estimatedValue.expected);
    expect(result.points.every((point) => point.marketValue!.low <= point.marketValue!.expected)).toBe(true);
    expect(result.points.every((point) => point.marketValue!.expected <= point.marketValue!.high)).toBe(true);
  });

  it("produces completion ROI, milestone values, and a peak", () => {
    const result = projectPlayerMarketValue(context());

    expect(result.completion?.marketValue?.expected).toBe(result.points.at(-1)!.marketValue!.expected);
    expect(result.roi.totalValueGain).toBe(result.completion!.valueGain);
    expect(result.roi.averageValueGainPerWeek).toBeCloseTo(
      result.roi.totalValueGain! / result.roi.totalTrainingWeeks!
    );
    expect(result.milestones).toHaveLength(2);
    expect(result.peak).not.toBeNull();
  });

  it("detects diminishing returns and supports a fixed horizon", () => {
    const result = projectPlayerMarketValue(context());
    const horizon = projectMarketValueAtHorizon(context(), 6);

    expect(result.roi.diminishingReturnPoint).not.toBeNull();
    expect(horizon.expected).toBe(result.points[0]!.marketValue!.expected);
  });

  it("compares paths and advanced versus formation without changing either path", () => {
    const advanced = context();
    const formation = context({
      projection: {
        ...advanced.projection,
        steps: advanced.projection.steps.map((item) => ({
          ...item,
          estimatedWeeks: item.estimatedWeeks! * 2,
          cumulativeWeeks: (item.cumulativeWeeks ?? 0) * 2,
          estimatedAge: (item.estimatedAge ?? player.age!) + 0.25
        })),
        completion: {
          ...advanced.projection.completion,
          estimatedWeeks: advanced.projection.completion.estimatedWeeks! * 2,
          estimatedAge: (advanced.projection.completion.estimatedAge ?? player.age!) + 0.25
        },
        assumptions: { ...advanced.projection.assumptions, trainingKind: "formation" }
      }
    });

    const scenarios = compareAdvancedAndFormationMarketValue({
      advanced,
      formation,
      fixedHorizonWeeks: 6
    });
    const paths = compareTrainingPathMarketValue({ first: advanced, second: formation });

    expect(scenarios.difference.fixedHorizonAdvancedValue).toBeGreaterThan(
      scenarios.difference.fixedHorizonFormationValue!
    );
    expect(scenarios.difference.valueGeneratedByAdvancedSlot).toBeGreaterThan(0);
    expect(paths.difference.completionWeeks).toBeGreaterThan(0);
  });

  it("handles a completed target with no future steps", () => {
    const completed = context({
      projection: projection([]),
      path: { ...path([]), completed: true },
      developmentPlan: {
        ...plan(),
        gap: { ...plan().gap, totalGap: 0, progress: 1, skills: plan().gap.skills.map((skill) => ({ ...skill, currentLevel: skill.targetLevel, levelsRemaining: 0, completed: true })) }
      }
    });
    const result = projectPlayerMarketValue(completed);

    expect(result.points).toHaveLength(0);
    expect(result.completion?.estimatedWeeks).toBe(0);
    expect(result.completion?.marketValue?.expected).toBe(result.current.calibratedValue.expected);
    expect(result.roi.totalValueGain).toBe(0);
  });

  it("increases value when a relevant skill improves", () => {
    const result = projectPlayerMarketValue(context());
    expect(result.points[0]!.marketValue!.expected).toBeGreaterThan(
      result.current.calibratedValue.expected
    );
  });

  it("keeps the age supplied by the projection instead of current age", () => {
    const result = projectPlayerMarketValue(context());
    expect(result.points[2]!.estimatedAge).toBe(19.3);
    expect(result.points[2]!.estimatedAge).not.toBe(player.age);
  });

  it("identifies the best economic step", () => {
    const result = projectPlayerMarketValue(context());
    expect(result.roi.bestValueStep).not.toBeNull();
    expect(result.roi.bestValueStep!.valueGainPerWeek).toBe(
      Math.max(...result.roi.stepEvaluations.map((evaluation) => evaluation.valueGainPerWeek!))
    );
  });

  it("keeps sporting path data separate from economic evaluation", () => {
    const currentPath = context().path;
    const result = projectPlayerMarketValue(context());
    expect(currentPath.steps[0]!.developmentValue).toBe(1);
    expect(result.roi.stepEvaluations[0]!.skill).toBe(currentPath.steps[0]!.skill);
  });

  it("reports a negative return when an extreme age change offsets a skill-up", () => {
    const extremeAgeStep = step(1, "defender", 12, 13, 20, 40);
    const result = projectPlayerMarketValue(
      context({
        player: { ...player, age: 18.4 },
        path: path([extremeAgeStep]),
        projection: projection([extremeAgeStep])
      })
    );

    expect(result.roi.stepEvaluations[0]!.valueGainPerWeek).toBeLessThan(0);
    expect(result.reasons).toContainEqual({ type: "negative_market_value_return", skill: "defender" });
  });

  it("can identify a projected peak before completion", () => {
    const first = step(1, "defender", 12, 13, 2, 18.5);
    const second = step(2, "pace", 11, 12, 100, 40);
    second.cumulativeWeeks = 102;
    const result = projectPlayerMarketValue(
      context({ path: path([first, second]), projection: projection([first, second]) })
    );

    expect(result.peak?.step).toBe(1);
    expect(result.reasons).toContainEqual({ type: "projected_peak_value" });
  });

  it("allows the peak to occur at completion", () => {
    const result = projectPlayerMarketValue(context());
    expect(result.peak?.step).toBe(3);
    expect(result.peak?.value).toBe(result.completion!.marketValue!.expected);
  });

  it("marks future evidence as weak when no transfer dataset is available", () => {
    const result = projectPlayerMarketValue(context());
    expect(result.confidence).toBe("low");
    expect(result.reasons).toContainEqual({ type: "future_market_segment_low_evidence" });
  });

  it("reduces confidence for a partial projection", () => {
    const base = context();
    const result = projectPlayerMarketValue({
      ...base,
      projection: { ...base.projection, projectionStatus: "partial" }
    });
    expect(result.confidence).toBe("low");
    expect(result.points.every((point) => point.confidence === "low")).toBe(true);
  });

  it("keeps future confidence from exceeding medium in this unobserved state model", () => {
    const base = context();
    const result = projectPlayerMarketValue({
      ...base,
      transfers: []
    });
    expect(result.points.every((point) => point.confidence !== "high")).toBe(true);
  });

  it("uses the fundamental estimate as the no-comparable fallback", () => {
    const base = context();
    const result = projectPlayerMarketValue({ ...base, transfers: [] });
    expect(result.current.comparableEstimate).toBeNull();
    expect(result.current.calibratedValue).toEqual(result.current.fundamental.estimatedValue);
  });

  it("keeps all monetary outputs finite", () => {
    const result = projectPlayerMarketValue(context());
    const values = [
      result.current.calibratedValue.low,
      result.current.calibratedValue.expected,
      result.current.calibratedValue.high,
      ...result.points.flatMap((point) =>
        point.marketValue ? [point.marketValue.low, point.marketValue.expected, point.marketValue.high] : []
      ),
      result.roi.totalValueGain ?? 0,
      result.roi.averageValueGainPerWeek ?? 0
    ];
    expect(values.every((value) => Number.isFinite(value))).toBe(true);
  });

  it("keeps projection output deterministic", () => {
    const first = projectPlayerMarketValue(context());
    const second = projectPlayerMarketValue(context());
    expect(first).toEqual(second);
  });

  it("exposes the skill-up milestone value", () => {
    const result = projectPlayerMarketValue(context());
    expect(result.milestones[0]!.marketValue).toEqual(result.points[2]!.marketValue);
    expect(result.milestones[0]!.valueGainFromCurrent).toBe(result.points[2]!.valueGainFromCurrent);
  });

  it("exposes development target completion value and timing", () => {
    const result = projectPlayerMarketValue(context());
    const completionMilestone = result.milestones.find(
      (milestone) => milestone.type === "development_target_completed"
    );
    expect(completionMilestone?.marketValue?.expected).toBe(result.completion!.marketValue!.expected);
    expect(result.completion!.estimatedWeeks).toBe(17);
  });

  it("uses the formation scenario assumptions without changing the player", () => {
    const base = context();
    const formation = projectPlayerMarketValue({
      ...base,
      projection: { ...base.projection, assumptions: { ...base.projection.assumptions, trainingKind: "formation" } }
    });
    expect(formation.playerId).toBe(player.playerId);
    expect(formation.points[0]!.skills).toEqual(base.projection.steps[0] ? { ...player.skills, defender: 13 } : player.skills);
  });

  it("shows advanced completion time advantage in a scenario comparison", () => {
    const base = context();
    const slowerProjection = {
      ...base.projection,
      completion: { ...base.projection.completion, estimatedWeeks: 34 },
      steps: base.projection.steps.map((item) => ({ ...item, cumulativeWeeks: (item.cumulativeWeeks ?? 0) * 2 }))
    };
    const comparison = compareAdvancedAndFormationMarketValue({
      advanced: base,
      formation: { ...base, projection: slowerProjection }
    });
    expect(comparison.difference.completionWeeks).toBeGreaterThan(0);
  });

  it("supports a zero-week horizon with the current value", () => {
    const current = projectPlayerMarketValue(context()).current.calibratedValue;
    const result = projectMarketValueAtHorizon(context(), 0);
    expect(result).toEqual(current);
  });

  it("returns a valid value when the horizon is after completion", () => {
    const projection = projectPlayerMarketValue(context());
    const result = projectMarketValueAtHorizon(context(), 100);
    expect(result).toEqual(projection.completion!.marketValue);
  });

  it("rejects an invalid fixed horizon", () => {
    expect(() => projectMarketValueAtHorizon(context(), -1)).toThrow(RangeError);
    expect(() => projectMarketValueAtHorizon(context(), Number.NaN)).toThrow(RangeError);
  });

  it("reports advanced value at a fixed horizon separately from completion value", () => {
    const base = context();
    const comparison = compareAdvancedAndFormationMarketValue({
      advanced: base,
      formation: base,
      fixedHorizonWeeks: 6
    });
    expect(comparison.difference.fixedHorizonWeeks).toBe(6);
    expect(comparison.difference.valueGeneratedByAdvancedSlot).toBe(0);
    expect(comparison.difference.completionValue).toBe(0);
  });

  it("compares total value generation for two training paths", () => {
    const base = context();
    const comparison = compareTrainingPathMarketValue({ first: base, second: base });
    expect(comparison.difference.totalValueGain).toBe(0);
    expect(comparison.difference.averageValueGainPerWeek).toBe(0);
  });

  it("does not mutate the source projection or player skills", () => {
    const base = context();
    const originalSkills = { ...base.player.skills };
    const originalSteps = base.projection.steps.map((item) => ({ ...item }));
    projectPlayerMarketValue(base);
    expect(base.player.skills).toEqual(originalSkills);
    expect(base.projection.steps).toEqual(originalSteps);
  });

  it("keeps range ordering at completion and milestones", () => {
    const result = projectPlayerMarketValue(context());
    const ranges = [
      result.completion?.marketValue,
      ...result.milestones.map((milestone) => milestone.marketValue)
    ];
    expect(ranges.every((range) => !range || (range.low <= range.expected && range.expected <= range.high))).toBe(true);
  });

  it("keeps missing talent non-blocking", () => {
    const result = projectPlayerMarketValue(context({ talent: null }));
    expect(result.points.length).toBe(3);
    expect(result.completion).not.toBeNull();
  });

  it("supports a target with only a partial available path", () => {
    const base = context();
    const partialSteps = base.projection.steps.slice(0, 1);
    const result = projectPlayerMarketValue({
      ...base,
      path: { ...base.path, steps: base.path.steps.slice(0, 1), completed: false },
      projection: { ...base.projection, steps: partialSteps, projectionStatus: "partial", completion: { estimatedWeeks: null, estimatedGameWeek: null, estimatedDate: null, estimatedAge: null } }
    });
    expect(result.points).toHaveLength(1);
    expect(result.completion).not.toBeNull();
    expect(result.completion!.marketValue).toBeNull();
  });

  it("keeps model version available for diagnostics", () => {
    const result = projectPlayerMarketValue(context());
    expect(result.modelVersion).toContain("market-value-v1");
  });
});

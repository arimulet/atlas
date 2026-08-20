import { describe, expect, it } from "vitest";

import {
  assessSquad,
  assessSquadRole,
  calculatePlayerLifecycle,
  SQUAD_PLANNING_CONFIG,
  type PlayerDevelopmentTarget,
  type SquadPlayerContext,
  type SquadRole
} from "../src/index.js";

const target: PlayerDevelopmentTarget = {
  playerId: 1,
  profile: "central_defender",
  targetSkills: [
    { skill: "defender", targetLevel: 15, priority: "primary" },
    { skill: "pace", targetLevel: 13, priority: "primary" },
    { skill: "technique", targetLevel: 11, priority: "secondary" }
  ],
  source: "manual"
};

function player(overrides: Partial<SquadPlayerContext> = {}): SquadPlayerContext {
  return {
    playerId: 1,
    age: 24,
    skills: { defender: 9, pace: 9, technique: 8 },
    profile: "central_defender",
    developmentTarget: { ...target },
    training: { kind: "advanced" },
    talent: { value: 1.1, confidence: "high", evidenceCount: 4, evidences: [] },
    historyWeeks: 4,
    ...overrides
  };
}

function withLevels(
  levels: { defender: number; pace: number; technique: number },
  overrides: Partial<SquadPlayerContext> = {}
): SquadPlayerContext {
  return player({ skills: levels, ...overrides });
}

describe("squad planning domain", () => {
  it("classifies a strong current player as core", () => {
    const assessment = assessSquadRole(
      withLevels({ defender: 15, pace: 14, technique: 12 }, { age: 24 })
    );

    expect(assessment.role).toBe("core");
    expect(assessment.reasons).toContainEqual({ type: "high_current_contribution" });
  });

  it("classifies a young high-potential player as prospect", () => {
    const assessment = assessSquadRole(
      withLevels({ defender: 4, pace: 5, technique: 4 }, { age: 20, ageFactor: 1 })
    );

    expect(assessment.role).toBe("prospect");
    expect(assessment.lifecycle).toBe("prospect");
    expect(assessment.reasons).toContainEqual({ type: "high_future_potential" });
  });

  it("classifies a competitive player with material growth as developing", () => {
    const assessment = assessSquadRole(
      withLevels({ defender: 10, pace: 10, technique: 9 }, { age: 22, ageFactor: 1.6 })
    );

    expect(assessment.role).toBe("developing");
    expect(assessment.lifecycle).toBe("development");
    expect(assessment.reasons).toContainEqual({ type: "active_development_plan" });
  });

  it("classifies a useful secondary player as rotation", () => {
    const assessment = assessSquadRole(
      withLevels({ defender: 11, pace: 10, technique: 9 }, { age: 25, developmentTarget: null })
    );

    expect(assessment.role).toBe("rotation");
  });

  it("classifies a limited coverage player as depth", () => {
    const assessment = assessSquadRole(
      withLevels(
        { defender: 5, pace: 5, technique: 5 },
        { age: 25, talent: null, developmentTarget: null, profile: "central_defender" }
      )
    );

    expect(assessment.role).toBe("depth");
  });

  it("classifies an advanced player with little development remaining as transition", () => {
    const assessment = assessSquadRole(
      withLevels(
        { defender: 15, pace: 13, technique: 11 },
        {
          age: 32,
          ageFactor: 7,
          developmentTarget: { ...target, targetSkills: target.targetSkills },
          profile: "central_defender"
        }
      )
    );

    expect(assessment.role).toBe("transition");
    expect(assessment.lifecycle).toBe("decline");
    expect(assessment.reasons).toContainEqual({ type: "limited_remaining_development" });
    expect(assessment.reasons).toContainEqual({ type: "late_lifecycle_stage" });
  });

  it("does not use age alone to determine the role", () => {
    const strong = assessSquadRole(
      withLevels({ defender: 15, pace: 14, technique: 12 }, { age: 22, ageFactor: 1.8 })
    );
    const weak = assessSquadRole(
      withLevels({ defender: 4, pace: 5, technique: 4 }, { age: 22, ageFactor: 1.8 })
    );

    expect(strong.role).not.toBe(weak.role);
  });

  it("allows players of the same age to have different lifecycle stages", () => {
    const developed = calculatePlayerLifecycle(
      withLevels({ defender: 15, pace: 14, technique: 12 }, { age: 22, ageFactor: 1.8 })
    );
    const developing = calculatePlayerLifecycle(
      withLevels({ defender: 10, pace: 10, technique: 9 }, { age: 22, ageFactor: 1.8 })
    );

    expect(developed).toBe("prime");
    expect(developing).toBe("development");
  });

  it("prioritizes a manual role while keeping the automatic suggestion", () => {
    const assessment = assessSquadRole(
      withLevels(
        { defender: 10, pace: 10, technique: 9 },
        {
          manualRole: { playerId: 1, role: "core", source: "manual" }
        }
      )
    );

    expect(assessment.role).toBe("core");
    expect(assessment.source).toBe("manual");
    expect(assessment.automaticRole).toBe("developing");
    expect(assessment.manualRole?.role).toBe("core");
  });

  it("keeps automatic role changes stable near a boundary", () => {
    const assessment = assessSquadRole(
      withLevels(
        { defender: 10, pace: 9, technique: 8 },
        {
          previousAutomaticRole: "developing"
        }
      )
    );

    expect(assessment.automaticRole).toBe("developing");
  });

  it("works without a development plan and lowers confidence without talent", () => {
    const assessment = assessSquadRole(
      withLevels(
        { defender: 10, pace: 9, technique: 8 },
        { developmentTarget: null, profile: null, talent: null, historyWeeks: 0 }
      )
    );

    expect(assessment.role).toBeDefined();
    expect(assessment.confidence).toBe("low");
    expect(assessment.reasons).toContainEqual({ type: "missing_development_plan" });
  });

  it("calculates deterministic relative percentiles and summary", () => {
    const contexts = [
      withLevels({ defender: 15, pace: 14, technique: 12 }, { playerId: 2 }),
      withLevels({ defender: 10, pace: 9, technique: 8 }, { playerId: 1 }),
      withLevels({ defender: 5, pace: 5, technique: 5 }, { playerId: 3 })
    ];

    const first = assessSquad(contexts);
    const second = assessSquad([...contexts].reverse());

    expect(first).toEqual(second);
    expect(first.players.map((assessment) => assessment.currentContributionPercentile)).toEqual([
      0.5, 1, 0
    ]);
    expect(Object.values(first.summary).reduce((total, value) => total + value, 0)).toBe(3);
    expect(first.summary.core).toBe(1);
  });

  it("exposes centralized stability settings", () => {
    expect(SQUAD_PLANNING_CONFIG.roleStabilityMargin).toBeGreaterThan(0);
  });

  it("does not persist derived assessment fields in the role assignment contract", () => {
    const assessment = assessSquadRole(player());
    const assignment = assessment.manualRole;

    expect(assignment).toBeNull();
    expect(Object.keys(assessment)).toContain("currentContributionScore");
    expect(Object.keys(assessment)).not.toContain("updatedAt");
  });
});

describe("squad role values", () => {
  it("keeps the six strategic roles explicit", () => {
    const roles: SquadRole[] = [
      "core",
      "developing",
      "prospect",
      "rotation",
      "depth",
      "transition"
    ];

    expect(roles).toHaveLength(6);
  });
});

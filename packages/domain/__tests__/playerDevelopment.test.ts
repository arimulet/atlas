import { describe, expect, it } from "vitest";

import {
  buildDefaultDevelopmentTarget,
  calculateDevelopmentGap,
  isDevelopmentTargetCompleted,
  PlayerDevelopmentPlanner,
  suggestDevelopmentProfile,
  type DevelopmentPlayer,
  type PlayerDevelopmentTarget
} from "@atlas/domain";

function player(overrides: Partial<DevelopmentPlayer> = {}): DevelopmentPlayer {
  return {
    playerId: 42,
    formation: "DEF",
    skills: {
      pace: 13,
      technique: 10,
      passing: 7,
      keeper: 1,
      defender: 14,
      playmaker: 8,
      striker: 3,
      stamina: 8
    },
    ...overrides
  };
}

describe("Player Development Plan", () => {
  it("suggests a profile from formation and compatible skills", () => {
    const suggestion = suggestDevelopmentProfile(player());

    expect(suggestion.profile).toBe("defender");
    expect(suggestion.confidence).toBe("high");
    expect(suggestion.reasons).toContainEqual({ type: "formation_match", formation: "DEF" });
  });

  it("explains strong skills and the profile distribution", () => {
    const suggestion = suggestDevelopmentProfile(player());

    expect(suggestion.reasons).toContainEqual({
      type: "strong_skill",
      skill: "defender",
      level: 14
    });
    expect(suggestion.reasons).toContainEqual({
      type: "profile_skill_distribution",
      profile: "defender"
    });
  });

  it("lets a clear skill distribution contradict the current formation", () => {
    const suggestion = suggestDevelopmentProfile(
      player({
        formation: "MID",
        skills: { pace: 13, striker: 12, technique: 12, playmaker: 7, passing: 6 }
      })
    );

    expect(suggestion.profile).toBe("forward");
    expect(suggestion.reasons).toContainEqual({
      type: "profile_better_than_current_formation",
      currentFormation: "MID",
      suggestedProfile: "forward"
    });
  });

  it("gives low confidence when there is not enough evidence", () => {
    const suggestion = suggestDevelopmentProfile({ playerId: 42, skills: { pace: 5 } });

    expect(suggestion.confidence).toBe("low");
  });

  it("uses a medium confidence when formation and skills provide only moderate evidence", () => {
    const suggestion = suggestDevelopmentProfile({
      playerId: 42,
      formation: "MID",
      skills: { pace: 8, playmaker: 8 }
    });

    expect(suggestion.confidence).toBe("medium");
  });

  it("keeps a manual profile ahead of automatic detection", () => {
    const suggestion = suggestDevelopmentProfile(player(), { profile: "forward" });

    expect(suggestion).toMatchObject({ profile: "forward", confidence: "high" });
    expect(suggestion.reasons).toContainEqual({ type: "manual_override", profile: "forward" });
  });

  it("does not compare a goalkeeper against field profiles", () => {
    const suggestion = suggestDevelopmentProfile({
      playerId: 7,
      formation: "GK",
      skills: { keeper: 14, pace: 8, passing: 7, striker: 12, defender: 12 }
    });

    expect(suggestion.profile).toBe("goalkeeper");
    expect(suggestion.reasons).toContainEqual({ type: "strong_skill", skill: "keeper", level: 14 });
  });

  it("can infer formation from the observed position when no formation code is present", () => {
    const suggestion = suggestDevelopmentProfile({
      playerId: 7,
      observedPosition: "striker",
      skills: { striker: 14, pace: 12, technique: 10 }
    });

    expect(suggestion.profile).toBe("forward");
    expect(suggestion.reasons).toContainEqual({ type: "formation_match", formation: "ATT" });
  });

  it("builds default targets from profile definitions", () => {
    const target = buildDefaultDevelopmentTarget(player(), "defender");

    expect(target).toMatchObject({
      playerId: 42,
      profile: "defender",
      source: "automatic"
    });
    expect(target.targetSkills.map(({ skill }) => skill)).toEqual([
      "defender",
      "pace",
      "technique",
      "playmaker"
    ]);
  });

  it("never creates an automatic target below the current skill", () => {
    const target = buildDefaultDevelopmentTarget(player(), "defender");

    expect(target.targetSkills.find((skill) => skill.skill === "defender")?.targetLevel).toBe(14);
  });

  it("preserves manual levels while deriving priorities from the profile", () => {
    const target = buildDefaultDevelopmentTarget(player(), "defender", {
      profile: "defender",
      targetLevels: { defender: 16, pace: 11 }
    });

    expect(target).toMatchObject({ source: "manual" });
    expect(target.targetSkills).toContainEqual({
      skill: "defender",
      targetLevel: 16,
      priority: "primary"
    });
  });

  it("calculates gaps, completion, total gap and weighted progress", () => {
    const current = player({ skills: { defender: 10, pace: 5, technique: 10 } });
    const target: PlayerDevelopmentTarget = {
      playerId: 42,
      profile: "defender",
      source: "automatic",
      targetSkills: [
        { skill: "defender", targetLevel: 10, priority: "primary" },
        { skill: "pace", targetLevel: 10, priority: "supporting" },
        { skill: "technique", targetLevel: 10, priority: "secondary" }
      ]
    };

    const gap = calculateDevelopmentGap(current, target);

    expect(gap.totalGap).toBe(5);
    expect(gap.progress).toBeCloseTo(5.5 / 6);
    expect(gap.skills).toContainEqual({
      skill: "defender",
      currentLevel: 10,
      targetLevel: 10,
      levelsRemaining: 0,
      priority: "primary",
      completed: true
    });
  });

  it("treats a skill above target as completed without extra progress", () => {
    const target: PlayerDevelopmentTarget = {
      playerId: 42,
      profile: "forward",
      source: "automatic",
      targetSkills: [{ skill: "striker", targetLevel: 13, priority: "primary" }]
    };

    const gap = calculateDevelopmentGap(player({ skills: { striker: 15 } }), target);

    expect(gap.totalGap).toBe(0);
    expect(gap.progress).toBe(1);
    expect(isDevelopmentTargetCompleted(gap)).toBe(true);
  });

  it("uses zero as the current level when a target skill is not observed", () => {
    const target: PlayerDevelopmentTarget = {
      playerId: 42,
      profile: "forward",
      source: "automatic",
      targetSkills: [{ skill: "striker", targetLevel: 10, priority: "primary" }]
    };

    const gap = calculateDevelopmentGap(player({ skills: {} }), target);

    expect(gap.skills[0]).toMatchObject({ currentLevel: 0, levelsRemaining: 10, completed: false });
  });

  it("does not mark a target completed while one relevant skill remains", () => {
    const target: PlayerDevelopmentTarget = {
      playerId: 42,
      profile: "forward",
      source: "automatic",
      targetSkills: [
        { skill: "striker", targetLevel: 10, priority: "primary" },
        { skill: "pace", targetLevel: 10, priority: "secondary" }
      ]
    };

    const gap = calculateDevelopmentGap(player({ skills: { striker: 10, pace: 9 } }), target);

    expect(isDevelopmentTargetCompleted(gap)).toBe(false);
  });

  it("reports a target as completed only when every target skill is complete", () => {
    const planner = new PlayerDevelopmentPlanner();
    const plan = planner.createPlan(
      player({ skills: { defender: 15, pace: 14, technique: 12, playmaker: 10 } }),
      {
        profile: "defender"
      }
    );

    expect(plan.target.source).toBe("manual");
    expect(isDevelopmentTargetCompleted(plan.gap)).toBe(true);
  });

  it("keeps derived target and gap data out of the persisted override shape", () => {
    const plan = new PlayerDevelopmentPlanner().createPlan(player());

    expect(plan.target).not.toHaveProperty("gap");
    expect(plan.target).not.toHaveProperty("suggestedProfile");
    expect(plan.target.source).toBe("automatic");
  });
});

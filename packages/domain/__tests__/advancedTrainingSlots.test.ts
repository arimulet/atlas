import { describe, expect, it } from "vitest";

import {
  calculateAdvancedSlotScore,
  calculateWeeklyTrainingPointsByKind,
  createTrainingHistory,
  createTrainingWeek,
  optimizeAdvancedTrainingSlots,
  type AdvancedTrainingCandidateContext,
  type PlayerTrainingRecommendation,
  type SkillTrainingCostSkill,
  type TalentEstimate,
  type TrainingRecommendationPlayer
} from "@atlas/domain";

const DEFAULT_DATE = new Date("2026-08-01");

function talent(value = 1, confidence: TalentEstimate["confidence"] = "high"): TalentEstimate {
  return { value, confidence, evidenceCount: 2, evidences: [] };
}

function candidate(input: {
  playerId: number;
  skill?: SkillTrainingCostSkill;
  level?: number;
  kind?: "advanced" | "formation";
  age?: number;
  talent?: TalentEstimate | null;
  historyWeeks?: number;
  trainingRecommendation?: PlayerTrainingRecommendation;
}): AdvancedTrainingCandidateContext {
  const skill = input.skill ?? "pace";
  const level = input.level ?? 10;
  const playerSkill = skill === "scoring" ? "striker" : skill;
  const historyWeeks = input.historyWeeks ?? 2;
  const weeks = Array.from({ length: historyWeeks }, (_, index) =>
    createTrainingWeek({
      playerId: input.playerId,
      gameWeek: 1200 + index,
      seasonWeek: index + 1,
      date: new Date(DEFAULT_DATE.getTime() + index * 7 * 24 * 60 * 60 * 1000),
      type: skill === "scoring" ? "striker" : skill,
      kind: input.kind ?? "formation",
      intensity: 100,
      age: input.age ?? 20,
      skills: { [playerSkill]: level },
      skillsChange: { [playerSkill]: 0, up: 0, down: 0 }
    })
  );
  const player: TrainingRecommendationPlayer = {
    playerId: input.playerId,
    age: input.age ?? 20,
    position: skill === "keeper" ? "goalkeeper" : skill === "defending" ? "defender" : "midfielder",
    skills: { [playerSkill]: level }
  };

  return {
    player,
    trainingHistory: createTrainingHistory(input.playerId, weeks),
    currentTraining: {
      skill,
      kind: input.kind ?? "formation",
      intensity: 100
    },
    talent: input.talent === undefined ? talent() : input.talent,
    trainingRecommendation: input.trainingRecommendation
  };
}

function optimize(candidates: AdvancedTrainingCandidateContext[]) {
  return optimizeAdvancedTrainingSlots(candidates, 1201);
}

describe("advanced slot score", () => {
  it("combines marginal training benefit with development potential", () => {
    const score = calculateAdvancedSlotScore({
      marginalTrainingPoints: 50,
      developmentPotentialScore: 0.8
    });

    expect(score).toBeCloseTo(0.4, 8);
  });

  it("returns null for unusable marginal input", () => {
    expect(
      calculateAdvancedSlotScore({ marginalTrainingPoints: 0, developmentPotentialScore: 0.8 })
    ).toBeNull();
  });

  it("derives advanced and formation points from the Training Domain", () => {
    const advanced = calculateWeeklyTrainingPointsByKind({ kind: "advanced", intensity: 100 });
    const formation = calculateWeeklyTrainingPointsByKind({ kind: "formation", intensity: 100 });

    expect(advanced).toBeGreaterThan(formation);
  });
});

describe("advanced training slot optimizer", () => {
  it("selects exactly ten valid candidates", () => {
    const result = optimize(
      Array.from({ length: 10 }, (_, index) => candidate({ playerId: index + 1 }))
    );

    expect(result.recommendedAdvancedPlayerIds).toHaveLength(10);
    expect(result.slotCount).toBe(10);
  });

  it("never selects more than ten players", () => {
    const result = optimize(
      Array.from({ length: 12 }, (_, index) => candidate({ playerId: index + 1 }))
    );

    expect(result.recommendedAdvancedPlayerIds).toHaveLength(10);
    expect(result.ranking).toHaveLength(12);
  });

  it("selects all candidates when fewer than ten are eligible", () => {
    const result = optimize(
      Array.from({ length: 4 }, (_, index) => candidate({ playerId: index + 1 }))
    );

    expect(result.recommendedAdvancedPlayerIds).toHaveLength(4);
  });

  it("keeps an advanced player inside the recommended slots", () => {
    const result = optimize([
      candidate({ playerId: 1, kind: "advanced", level: 6 }),
      ...Array.from({ length: 9 }, (_, index) => candidate({ playerId: index + 2 }))
    ]);

    expect(result.recommendations.find((item) => item.playerId === 1)?.status).toBe(
      "keep_advanced"
    );
  });

  it("promotes a formation player that enters the top ten", () => {
    const result = optimize([
      candidate({ playerId: 1, kind: "advanced", level: 17 }),
      ...Array.from({ length: 9 }, (_, index) =>
        candidate({ playerId: index + 2, kind: "advanced", level: 10 })
      ),
      candidate({ playerId: 11, kind: "formation", level: 4 })
    ]);

    expect(result.recommendations.find((item) => item.playerId === 11)?.status).toBe(
      "promote_to_advanced"
    );
  });

  it("removes an advanced player that falls outside the recommended slots", () => {
    const result = optimize([
      candidate({ playerId: 1, kind: "advanced", level: 17 }),
      ...Array.from({ length: 9 }, (_, index) =>
        candidate({ playerId: index + 2, kind: "advanced", level: 10 })
      ),
      candidate({ playerId: 11, kind: "formation", level: 4 })
    ]);

    expect(result.recommendations.find((item) => item.playerId === 1)?.status).toBe(
      "remove_from_advanced"
    );
  });

  it("keeps a formation player outside the recommended slots", () => {
    const result = optimize([
      ...Array.from({ length: 10 }, (_, index) =>
        candidate({ playerId: index + 1, kind: "advanced", level: 4 })
      ),
      candidate({ playerId: 11, kind: "formation", level: 17 })
    ]);

    expect(result.recommendations.find((item) => item.playerId === 11)?.status).toBe(
      "keep_formation"
    );
  });

  it("suggests a replacement when an outside candidate is clearly better", () => {
    const result = optimize([
      ...Array.from({ length: 9 }, (_, index) =>
        candidate({ playerId: index + 1, kind: "advanced", level: 4 })
      ),
      candidate({ playerId: 10, kind: "advanced", level: 17 }),
      candidate({ playerId: 11, kind: "formation", level: 4 })
    ]);

    expect(result.replacements).toContainEqual(
      expect.objectContaining({ promotePlayerId: 11, removePlayerId: 10 })
    );
  });

  it("does not replace a player for a marginal score difference", () => {
    const result = optimize([
      ...Array.from({ length: 9 }, (_, index) =>
        candidate({ playerId: index + 1, kind: "advanced", level: 4 })
      ),
      candidate({ playerId: 10, kind: "advanced", level: 10, age: 20.1 }),
      candidate({ playerId: 11, kind: "formation", level: 10, age: 20 })
    ]);

    expect(result.replacements).toHaveLength(0);
    expect(result.recommendations.find((item) => item.playerId === 10)?.status).toBe(
      "keep_advanced"
    );
  });

  it("gives a better-trained talent estimate higher priority", () => {
    const result = optimize([
      candidate({ playerId: 1, talent: talent(1) }),
      candidate({ playerId: 2, talent: talent(2) })
    ]);

    expect(result.ranking[0]?.playerId).toBe(1);
  });

  it("reduces return for older players through the age factor", () => {
    const result = optimize([
      candidate({ playerId: 1, age: 16 }),
      candidate({ playerId: 2, age: 30 })
    ]);

    expect(result.ranking[0]?.playerId).toBe(1);
  });

  it("does not throw when talent is unavailable", () => {
    const result = optimize([
      candidate({ playerId: 1, talent: null }),
      candidate({ playerId: 2, talent: talent() })
    ]);

    expect(result.ranking).toHaveLength(2);
    expect(result.ranking.find((entry) => entry.playerId === 1)?.score).not.toBeNull();
  });

  it("holds candidates with insufficient history", () => {
    const result = optimize([
      candidate({ playerId: 1, historyWeeks: 1 }),
      candidate({ playerId: 2, historyWeeks: 1 })
    ]);

    expect(result.recommendations.every((recommendation) => recommendation.status === "hold")).toBe(
      true
    );
  });

  it("uses the skill recommended by Iteration 2 for potential", () => {
    const trainingRecommendation: PlayerTrainingRecommendation = {
      playerId: 1,
      status: "switch_skill",
      currentSkill: "defending",
      recommendedSkill: "pace",
      currentOption: {
        skill: "defending",
        currentLevel: 13,
        estimatedWeeksToNextLevel: 5,
        requiredTrainingPoints: 500,
        expectedWeeklyTrainingPoints: 100,
        developmentReturnScore: 0.1
      },
      alternatives: [
        {
          skill: "pace",
          currentLevel: 4,
          estimatedWeeksToNextLevel: 1,
          requiredTrainingPoints: 100,
          expectedWeeklyTrainingPoints: 100,
          developmentReturnScore: 0.9
        }
      ],
      confidence: "high",
      reasons: []
    };
    const result = optimize([
      candidate({
        playerId: 1,
        skill: "defending",
        level: 13,
        trainingRecommendation
      })
    ]);

    expect(result.ranking[0]?.score).toBeGreaterThan(0);
    expect(result.ranking[0]?.confidence).toBe("high");
  });

  it("uses player id as the stable tie-breaker", () => {
    const result = optimize([candidate({ playerId: 2 }), candidate({ playerId: 1 })]);

    expect(result.ranking.map((entry) => entry.playerId)).toEqual([1, 2]);
  });

  it("reports summary changes and links replacements correctly", () => {
    const result = optimize([
      ...Array.from({ length: 9 }, (_, index) =>
        candidate({ playerId: index + 1, kind: "advanced", level: 4 })
      ),
      candidate({ playerId: 10, kind: "advanced", level: 17 }),
      candidate({ playerId: 11, kind: "formation", level: 4 })
    ]);

    expect(result.summary).toMatchObject({ promotions: 1, removals: 1, recommendedChanges: 2 });
    expect(result.replacements[0]).toMatchObject({
      promotePlayerId: 11,
      removePlayerId: 10
    });
  });

  it("uses the advanced-versus-formation difference rather than potential alone", () => {
    const result = optimize([candidate({ playerId: 1 })]);
    const evaluation = result.recommendations[0]!.evaluation;

    expect(evaluation.marginalTrainingPoints).toBe(
      evaluation.expectedAdvancedTrainingPoints! - evaluation.expectedFormationTrainingPoints!
    );
    expect(evaluation.advancedScore).toBeGreaterThan(0);
  });

  it("does not make aggressive changes for low-confidence candidates", () => {
    const result = optimize([
      candidate({ playerId: 1, kind: "advanced", level: 17, historyWeeks: 1 }),
      candidate({ playerId: 2, kind: "formation", level: 4, historyWeeks: 1 })
    ]);

    expect(result.replacements).toHaveLength(0);
    expect(result.recommendations.every((recommendation) => recommendation.status === "hold")).toBe(
      true
    );
  });

  it("holds an invalid current training kind instead of ranking it", () => {
    const invalid = candidate({ playerId: 1 });
    invalid.currentTraining.kind = "missing";
    const result = optimize([invalid, candidate({ playerId: 2 })]);

    expect(result.ranking.map((entry) => entry.playerId)).toEqual([2]);
    expect(result.recommendations.find((item) => item.playerId === 1)?.status).toBe("hold");
  });

  it("excludes a skill that is not trainable for the observed position", () => {
    const invalid = candidate({ playerId: 1, skill: "keeper" });
    invalid.player.position = "defender";
    const result = optimize([invalid, candidate({ playerId: 2 })]);

    expect(result.ranking.map((entry) => entry.playerId)).toEqual([2]);
    expect(result.recommendations.find((item) => item.playerId === 1)?.status).toBe("hold");
  });
});

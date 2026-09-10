import { describe, expect, it } from "vitest";

import {
  buildTrainingRecommendation,
  buildWeeklyTrainingReport,
  calculateDevelopmentReturnScore,
  createTrainingHistory,
  createTrainingWeek,
  evaluateTrainingOption,
  type PlayerSkills,
  type SkillTrainingCostSkill,
  type TalentEstimate,
  type TrainingRecommendationPlayer,
  type TrainingWeekInput
} from "@atlas/domain";

const PLAYER_ID = 40098056;

function week(
  input: {
    gameWeek?: number;
    skill?: SkillTrainingCostSkill;
    level?: number;
    intensity?: number;
    skillUp?: boolean;
  } = {}
) {
  const skill = input.skill ?? "defending";
  const playerSkill = skill === "scoring" ? "striker" : skill;
  const level = input.level ?? 10;
  const skillUp = input.skillUp ?? false;
  const skills: PlayerSkills = { [playerSkill]: level };
  const skillsChange = {
    [playerSkill]: skillUp ? 1 : 0,
    up: skillUp ? 1 : 0,
    down: 0
  } as TrainingWeekInput["skillsChange"];

  return createTrainingWeek({
    playerId: PLAYER_ID,
    gameWeek: input.gameWeek ?? 1200,
    seasonWeek: 1,
    date: new Date("2026-08-01"),
    type: skill === "scoring" ? "striker" : skill,
    kind: "advanced",
    intensity: input.intensity ?? 100,
    age: 20,
    skills,
    skillsChange
  });
}

function talent(value = 1, confidence: TalentEstimate["confidence"] = "high"): TalentEstimate {
  return { value, confidence, evidenceCount: 2, evidences: [] };
}

function recommendationContext(input: {
  weeks: ReturnType<typeof week>[];
  player: Omit<TrainingRecommendationPlayer, "playerId">;
  talent?: TalentEstimate | null;
  gameWeek?: number;
}) {
  const history = createTrainingHistory(PLAYER_ID, input.weeks);
  const weeklyReport = buildWeeklyTrainingReport({
    players: [{ history, talent: input.talent?.value ?? 1 }],
    gameWeek: input.gameWeek
  }).players[0]!;

  return {
    player: { ...input.player, playerId: PLAYER_ID },
    weeklyReport,
    trainingHistory: history,
    talent: input.talent
  };
}

describe("development return score", () => {
  it("is independently comparable across skill difficulty and level", () => {
    const difficultSkill = calculateDevelopmentReturnScore({
      age: 20,
      talent: 1,
      skill: "defending",
      currentSkillLevel: 13,
      expectedWeeklyTrainingPoints: 100
    });
    const lowerLevelSkill = calculateDevelopmentReturnScore({
      age: 20,
      talent: 1,
      skill: "pace",
      currentSkillLevel: 10,
      expectedWeeklyTrainingPoints: 100
    });

    expect(difficultSkill).not.toBeNull();
    expect(lowerLevelSkill).not.toBeNull();
    expect(lowerLevelSkill).toBeGreaterThan(difficultSkill!);
    expect(lowerLevelSkill).toBeLessThan(1);
  });

  it("gives a higher return to a young player than an older player", () => {
    const young = calculateDevelopmentReturnScore({
      age: 16,
      talent: 1,
      skill: "technique",
      currentSkillLevel: 8,
      expectedWeeklyTrainingPoints: 100
    });
    const older = calculateDevelopmentReturnScore({
      age: 30,
      talent: 1,
      skill: "technique",
      currentSkillLevel: 8,
      expectedWeeklyTrainingPoints: 100
    });

    expect(young).toBeGreaterThan(older!);
  });

  it("returns null when the next level cannot be trained", () => {
    const score = calculateDevelopmentReturnScore({
      age: 20,
      skill: "pace",
      currentSkillLevel: 18,
      expectedWeeklyTrainingPoints: 100
    });

    expect(score).toBeNull();
  });
});

describe("training recommendation engine", () => {
  it("continues when the current skill has the clearly better return", () => {
    const context = recommendationContext({
      weeks: [
        week({ gameWeek: 1200, skill: "playmaking", level: 6 }),
        week({ gameWeek: 1201, skill: "playmaking", level: 6 })
      ],
      player: {
        age: 20,
        position: "midfielder",
        skills: { playmaking: 6, passing: 12, technique: 12, pace: 12 }
      },
      talent: talent()
    });

    const recommendation = buildTrainingRecommendation(context);

    expect(recommendation.status).toBe("continue");
    expect(recommendation.recommendedSkill).toBeUndefined();
    expect(recommendation.currentOption.developmentReturnScore).toBeGreaterThan(
      recommendation.alternatives[0]!.developmentReturnScore!
    );
  });

  it("switches to the best clearly superior alternative", () => {
    const context = recommendationContext({
      weeks: [week({ gameWeek: 1200, level: 12 }), week({ gameWeek: 1201, level: 13 })],
      player: {
        age: 20,
        position: "defender",
        skills: { defending: 13, pace: 10, technique: 14, passing: 14 }
      },
      talent: talent()
    });

    const recommendation = buildTrainingRecommendation(context);

    expect(recommendation.status).toBe("switch_skill");
    expect(recommendation.recommendedSkill).toBe("pace");
    expect(recommendation.reasons).toContainEqual(
      expect.objectContaining({ type: "better_alternative", alternativeSkill: "pace" })
    );
  });

  it("continues when the alternative improvement is only marginal", () => {
    const context = recommendationContext({
      weeks: [week({ gameWeek: 1200, level: 10 }), week({ gameWeek: 1201, level: 10 })],
      player: {
        age: 20,
        position: "defender",
        skills: { defending: 10, pace: 9, technique: 18, passing: 18 }
      },
      talent: talent()
    });

    const recommendation = buildTrainingRecommendation(context);

    expect(recommendation.status).toBe("continue");
  });

  it("holds on a first observation without enough evidence", () => {
    const context = recommendationContext({
      weeks: [week()],
      player: {
        age: 20,
        position: "defender",
        skills: { defending: 10, pace: 8 }
      }
    });

    const recommendation = buildTrainingRecommendation(context);

    expect(recommendation.status).toBe("hold");
    expect(recommendation.confidence).toBe("low");
    expect(recommendation.reasons).toContainEqual({ type: "insufficient_history" });
  });

  it("keeps a recent skill-up when the current return remains better", () => {
    const context = recommendationContext({
      weeks: [
        week({ gameWeek: 1200, skill: "playmaking", level: 6 }),
        week({ gameWeek: 1201, skill: "playmaking", level: 7, skillUp: true })
      ],
      player: {
        age: 20,
        position: "midfielder",
        skills: { playmaking: 7, passing: 14, technique: 14, pace: 14 }
      },
      talent: talent()
    });

    const recommendation = buildTrainingRecommendation(context);

    expect(recommendation.status).toBe("continue");
    expect(recommendation.reasons).toContainEqual({
      type: "recent_skill_up",
      skill: "playmaking"
    });
  });

  it("re-evaluates after a recent skill-up when another skill is clearly better", () => {
    const context = recommendationContext({
      weeks: [
        week({ gameWeek: 1200, level: 12 }),
        week({ gameWeek: 1201, level: 13, skillUp: true })
      ],
      player: {
        age: 20,
        position: "defender",
        skills: { defending: 13, pace: 10, technique: 14, passing: 14 }
      },
      talent: talent()
    });

    const recommendation = buildTrainingRecommendation(context);

    expect(recommendation.status).toBe("switch_skill");
    expect(recommendation.recommendedSkill).toBe("pace");
    expect(recommendation.reasons).toContainEqual({
      type: "recent_skill_up",
      skill: "defending"
    });
  });

  it("does not recommend goalkeeper training to a field player", () => {
    const context = recommendationContext({
      weeks: [week({ gameWeek: 1200 }), week({ gameWeek: 1201 })],
      player: {
        age: 20,
        position: "defender",
        skills: { defending: 10, pace: 8, keeper: 1 }
      },
      talent: talent()
    });

    const recommendation = buildTrainingRecommendation(context);

    expect(recommendation.alternatives.map((alternative) => alternative.skill)).not.toContain(
      "keeper"
    );
  });

  it("holds when no alternative has a valid observed level", () => {
    const context = recommendationContext({
      weeks: [week({ gameWeek: 1200 }), week({ gameWeek: 1201 })],
      player: {
        age: 20,
        position: "defender",
        skills: { defending: 10 }
      },
      talent: talent()
    });

    const recommendation = buildTrainingRecommendation(context);

    expect(recommendation.status).toBe("hold");
    expect(recommendation.recommendedSkill).toBeUndefined();
    expect(recommendation.reasons).toEqual([{ type: "no_valid_alternative" }]);
  });

  it("keeps confidence high with stable talent and observed skill-up evidence", () => {
    const context = recommendationContext({
      weeks: [
        week({ gameWeek: 1200, level: 10 }),
        week({ gameWeek: 1201, level: 11, skillUp: true })
      ],
      player: {
        age: 20,
        position: "defender",
        skills: { defending: 11, pace: 8 }
      },
      talent: talent(1, "high")
    });

    expect(buildTrainingRecommendation(context).confidence).toBe("high");
  });

  it("does not break when talent is unavailable", () => {
    const context = recommendationContext({
      weeks: [
        week({ gameWeek: 1200, level: 10 }),
        week({ gameWeek: 1201, level: 11, skillUp: true })
      ],
      player: {
        age: 20,
        position: "defender",
        skills: { defending: 11, pace: 8 }
      },
      talent: null
    });

    const recommendation = buildTrainingRecommendation(context);

    expect(recommendation.status).not.toBe("hold");
    expect(recommendation.confidence).toBe("medium");
    expect(recommendation.currentOption.requiredTrainingPoints).toBeNull();
    expect(recommendation.currentOption.developmentReturnScore).not.toBeNull();
  });

  it("uses hysteresis after a recent training skill change", () => {
    const context = recommendationContext({
      weeks: [
        week({ gameWeek: 1200, skill: "pace", level: 9 }),
        week({ gameWeek: 1201, skill: "defending", level: 10 })
      ],
      player: {
        age: 20,
        position: "defender",
        skills: { defending: 10, pace: 9, technique: 18, passing: 18 }
      },
      talent: talent()
    });

    expect(buildTrainingRecommendation(context).status).toBe("continue");
  });

  it("evaluates alternatives with their own levels, weeks and required points", () => {
    const evaluation = evaluateTrainingOption({
      age: 20,
      skill: "pace",
      currentLevel: 10,
      expectedWeeklyTrainingPoints: 100,
      talent: 1
    });

    expect(evaluation).toMatchObject({
      skill: "pace",
      currentLevel: 10,
      expectedWeeklyTrainingPoints: 100
    });
    expect(evaluation.requiredTrainingPoints).toBeGreaterThan(0);
    expect(evaluation.estimatedWeeksToNextLevel).toBeGreaterThan(0);
    expect(evaluation.developmentReturnScore).toBeGreaterThan(0);
  });
});

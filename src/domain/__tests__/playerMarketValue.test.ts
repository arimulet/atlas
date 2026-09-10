import { describe, expect, it } from "vitest";

import {
  calculateMarketAgeFactor,
  calculateSkillValue,
  createMarketValueCalibrationSample,
  estimatePlayerMarketValue,
  estimateSquadMarketValues,
  PlayerDevelopmentPlanner,
  PlayerMarketValuationService,
  type PlayerMarketValueContext,
  type PlayerMarketValuePlayer,
  type TalentEstimate
} from "@atlas/domain";

function player(overrides: Partial<PlayerMarketValuePlayer> = {}): PlayerMarketValuePlayer {
  return {
    playerId: 1,
    age: 22,
    formation: "DEF",
    skills: {
      stamina: 8,
      pace: 11,
      technique: 10,
      passing: 8,
      keeper: 1,
      defender: 13,
      playmaker: 9,
      striker: 3
    },
    value: { amount: 1_100_000, currency: "ARS" },
    ...overrides
  };
}

function context(overrides: Partial<PlayerMarketValueContext> = {}): PlayerMarketValueContext {
  return { player: player(), ...overrides };
}

function talent(value: number, confidence: TalentEstimate["confidence"]): TalentEstimate {
  return { value, confidence, evidenceCount: confidence === "high" ? 4 : 1, evidences: [] };
}

function developmentPlan(
  currentPlayer: PlayerMarketValuePlayer,
  targetLevels: Partial<Record<"defender" | "pace" | "technique" | "playmaker", number>>
) {
  return new PlayerDevelopmentPlanner().createPlan(
    {
      playerId: currentPlayer.playerId,
      age: currentPlayer.age,
      formation: currentPlayer.formation,
      observedPosition: currentPlayer.observedPosition,
      skills: currentPlayer.skills
    },
    { profile: "defender", targetLevels }
  );
}

describe("Player Market Value", () => {
  it("increases when skills increase", () => {
    const lower = estimatePlayerMarketValue(
      context({ player: player({ skills: { defender: 10, pace: 10, technique: 9 } }) })
    );
    const higher = estimatePlayerMarketValue(
      context({ player: player({ skills: { defender: 14, pace: 13, technique: 11 } }) })
    );

    expect(higher.estimatedValue.expected).toBeGreaterThan(lower.estimatedValue.expected);
  });

  it("makes an elite skill increment worth more than a low-level increment", () => {
    const lowIncrement =
      calculateSkillValue(player({ skills: { defender: 9, pace: 10, technique: 9 } })) -
      calculateSkillValue(player({ skills: { defender: 7, pace: 10, technique: 9 } }));
    const eliteIncrement =
      calculateSkillValue(player({ skills: { defender: 15, pace: 10, technique: 9 } })) -
      calculateSkillValue(player({ skills: { defender: 13, pace: 10, technique: 9 } }));

    expect(eliteIncrement).toBeGreaterThan(lowIncrement);
  });

  it("values a younger player more when skills are equal", () => {
    const young = estimatePlayerMarketValue(context({ player: player({ age: 18 }) }));
    const old = estimatePlayerMarketValue(context({ player: player({ age: 31 }) }));

    expect(young.estimatedValue.expected).toBeGreaterThan(old.estimatedValue.expected);
  });

  it("uses a smooth progressive age factor", () => {
    const factors = [18, 22, 27, 31].map((age) => calculateMarketAgeFactor(age));

    expect(factors[0]).toBeGreaterThan(factors[1]!);
    expect(factors[1]).toBeGreaterThan(factors[2]!);
    expect(factors[2]).toBeGreaterThan(factors[3]!);
    expect(calculateMarketAgeFactor(22) - calculateMarketAgeFactor(21)).toBeCloseTo(
      calculateMarketAgeFactor(27) - calculateMarketAgeFactor(26),
      1
    );
  });

  it("explains both young premiums and age discounts", () => {
    const young = estimatePlayerMarketValue(context({ player: player({ age: 18 }) }));
    const senior = estimatePlayerMarketValue(context({ player: player({ age: 31 }) }));

    expect(young.reasons).toContainEqual({ type: "young_age_premium" });
    expect(senior.reasons).toContainEqual({ type: "age_discount" });
    expect(young.breakdown.ageAdjustment).toBeGreaterThan(0);
    expect(senior.breakdown.ageAdjustment).toBeLessThan(0);
  });

  it("uses the relevant skills from the selected profile", () => {
    const weakForward = estimatePlayerMarketValue(
      context({
        developmentProfile: "forward",
        player: player({ skills: { striker: 8, pace: 10, technique: 9, defender: 18 } })
      })
    );
    const strongForward = estimatePlayerMarketValue(
      context({
        developmentProfile: "forward",
        player: player({ skills: { striker: 14, pace: 12, technique: 11, defender: 8 } })
      })
    );

    expect(strongForward.estimatedValue.expected).toBeGreaterThan(
      weakForward.estimatedValue.expected
    );
  });

  it("does not let an irrelevant skill dominate a profile valuation", () => {
    const withoutIrrelevantSkill = estimatePlayerMarketValue(
      context({
        developmentProfile: "forward",
        player: player({ skills: { striker: 12, pace: 11, technique: 10, defender: 1 } })
      })
    );
    const withIrrelevantSkill = estimatePlayerMarketValue(
      context({
        developmentProfile: "forward",
        player: player({ skills: { striker: 12, pace: 11, technique: 10, defender: 20 } })
      })
    );

    expect(withIrrelevantSkill.estimatedValue.expected).toBe(
      withoutIrrelevantSkill.estimatedValue.expected
    );
  });

  it("gives a moderate premium to a complete relevant skill distribution", () => {
    const concentrated = estimatePlayerMarketValue(
      context({
        developmentProfile: "forward",
        player: player({ skills: { striker: 15, pace: 5, technique: 4, passing: 2 } })
      })
    );
    const complete = estimatePlayerMarketValue(
      context({
        developmentProfile: "forward",
        player: player({ skills: { striker: 13, pace: 12, technique: 11, passing: 8 } })
      })
    );

    expect(complete.breakdown.skillDistributionAdjustment).toBeGreaterThan(
      concentrated.breakdown.skillDistributionAdjustment
    );
    expect(complete.reasons).toContainEqual({ type: "strong_skill_distribution" });
  });

  it("uses the goalkeeper profile and goalkeeper skills", () => {
    const lowKeeper = estimatePlayerMarketValue(
      context({
        developmentProfile: "goalkeeper",
        player: player({ skills: { keeper: 8, pace: 8, passing: 7, striker: 18 } })
      })
    );
    const highKeeper = estimatePlayerMarketValue(
      context({
        developmentProfile: "goalkeeper",
        player: player({ skills: { keeper: 14, pace: 10, passing: 9, striker: 2 } })
      })
    );

    expect(highKeeper.estimatedValue.expected).toBeGreaterThan(lowKeeper.estimatedValue.expected);
  });

  it("falls back to formation and lowers confidence", () => {
    const estimate = estimatePlayerMarketValue(
      context({ developmentProfile: null, player: player({ formation: "DEF" }) })
    );

    expect(estimate.reasons).toContainEqual({
      type: "profile_fallback_used",
      profile: "defender"
    });
    expect(estimate.confidence).toBe("low");
  });

  it("can infer a goalkeeper fallback from the snapshot training position", () => {
    const estimate = estimatePlayerMarketValue(
      context({
        developmentProfile: null,
        player: player({
          formation: undefined,
          training: { position: 0 },
          skills: { keeper: 14, pace: 9, passing: 8, striker: 15 }
        })
      })
    );

    expect(estimate.reasons).toContainEqual({
      type: "profile_fallback_used",
      profile: "goalkeeper"
    });
  });

  it("does not require talent", () => {
    const estimate = estimatePlayerMarketValue(context({ talent: null }));

    expect(estimate.estimatedValue.expected).toBeGreaterThanOrEqual(0);
    expect(estimate.reasons).not.toContainEqual({ type: "talent_low_confidence" });
  });

  it("keeps high-confidence talent as a moderate adjustment", () => {
    const noTalent = estimatePlayerMarketValue(context({ talent: null }));
    const highTalent = estimatePlayerMarketValue(
      context({
        talent: talent(1.2, "high"),
        developmentPlan: developmentPlan(player(), { defender: 16, pace: 15 })
      })
    );

    expect(highTalent.breakdown.developmentAdjustment).toBeGreaterThan(
      noTalent.breakdown.developmentAdjustment
    );
    expect(highTalent.breakdown.developmentAdjustment).toBeLessThan(
      highTalent.breakdown.skillValue * 0.1
    );
  });

  it("limits low-confidence talent impact", () => {
    const high = estimatePlayerMarketValue(
      context({
        talent: talent(1.2, "high"),
        developmentPlan: developmentPlan(player(), { defender: 16, pace: 15 })
      })
    );
    const low = estimatePlayerMarketValue(
      context({
        talent: talent(1.2, "low"),
        developmentPlan: developmentPlan(player(), { defender: 16, pace: 15 })
      })
    );

    expect(low.breakdown.developmentAdjustment).toBeLessThan(high.breakdown.developmentAdjustment);
  });

  it("adds development value only when a plan has real upside", () => {
    const current = player({ skills: { defender: 12, pace: 10, technique: 9, playmaker: 7 } });
    const withoutPlan = estimatePlayerMarketValue(context({ player: current }));
    const withUpside = estimatePlayerMarketValue(
      context({
        player: current,
        developmentPlan: developmentPlan(current, { defender: 16, pace: 14, technique: 11 })
      })
    );
    const nearlyComplete = player({
      skills: { defender: 14, pace: 13, technique: 11, playmaker: 9 }
    });
    const nearlyCompleteEstimate = estimatePlayerMarketValue(
      context({
        player: nearlyComplete,
        developmentPlan: developmentPlan(nearlyComplete, {
          defender: 15,
          pace: 13,
          technique: 11,
          playmaker: 9
        }),
        talent: talent(1.2, "high")
      })
    );

    expect(withUpside.breakdown.developmentAdjustment).toBeGreaterThan(
      withoutPlan.breakdown.developmentAdjustment
    );
    expect(nearlyCompleteEstimate.breakdown.developmentAdjustment).toBeLessThan(
      nearlyCompleteEstimate.breakdown.skillValue * 0.02
    );
  });

  it("guards against negative, NaN and infinite output", () => {
    const estimate = estimatePlayerMarketValue(
      context({ player: player({ age: null, skills: { defender: -10, pace: Number.NaN } }) })
    );

    expect(estimate.estimatedValue.low).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(estimate.estimatedValue.expected)).toBe(true);
    expect(Number.isFinite(estimate.breakdown.finalValue)).toBe(true);
  });

  it("is deterministic and breakdown reconstructs the expected value", () => {
    const first = estimatePlayerMarketValue(context());
    const second = estimatePlayerMarketValue(context());

    expect(first).toEqual(second);
    expect(
      first.breakdown.skillValue +
        first.breakdown.ageAdjustment +
        first.breakdown.profileAdjustment +
        first.breakdown.skillDistributionAdjustment +
        first.breakdown.developmentAdjustment
    ).toBe(first.estimatedValue.expected);
    expect(first.breakdown.rawValue).toBe(first.breakdown.finalValue);
  });

  it("calculates squad totals, median and deterministic ranking", () => {
    const assessment = estimateSquadMarketValues([
      context({ player: player({ playerId: 3, age: 31 }) }),
      context({ player: player({ playerId: 1, age: 18 }) }),
      context({ player: player({ playerId: 2, age: 24 }) })
    ]);

    expect(assessment.totalEstimatedValue).toBe(
      assessment.players.reduce((total, item) => total + item.estimatedValue.expected, 0)
    );
    expect(assessment.averageEstimatedValue).toBe(
      Math.round(assessment.totalEstimatedValue / assessment.players.length)
    );
    expect(assessment.ranking[0]?.playerId).toBe(1);
    expect(assessment.mostValuablePlayerIds).toEqual([1]);
    expect(assessment.medianEstimatedValue).toBe(assessment.players[1]?.estimatedValue.expected);
  });

  it("keeps Sokker value separate and exposes a diagnostic ratio", () => {
    const estimate = estimatePlayerMarketValue(context());
    const sokkerValue = estimate.sokkerValue;

    expect(sokkerValue).toBe(1_100_000);
    expect(estimate.estimatedValue.expected).not.toBe(sokkerValue);
    expect(estimate.marketToSokkerRatio).toBe(estimate.estimatedValue.expected / sokkerValue!);
  });

  it("creates a calibration sample without changing the valuation", () => {
    const valuation = estimatePlayerMarketValue(context());
    const sample = createMarketValueCalibrationSample(context(), valuation);

    expect(sample).toMatchObject({
      playerId: 1,
      estimatedMarketValue: valuation.estimatedValue.expected,
      sokkerValue: 1_100_000,
      profile: "defender"
    });
    expect(sample.primarySkills).toMatchObject({ defender: 13, pace: 11 });
  });

  it("supports the service facade and empty squad assessment", () => {
    const service = new PlayerMarketValuationService();
    const valuation = service.estimatePlayerMarketValue(context());
    const emptySquad = service.estimateSquadMarketValues([]);

    expect(valuation.estimatedMarketValue).toEqual(valuation.estimatedValue);
    expect(emptySquad).toMatchObject({
      players: [],
      ranking: [],
      totalEstimatedValue: 0,
      averageEstimatedValue: 0,
      medianEstimatedValue: 0,
      mostValuablePlayerIds: []
    });
  });

  it("uses medium confidence for complete observable data and never claims V1 calibration", () => {
    const estimate = estimatePlayerMarketValue(context({ developmentProfile: "defender" }));

    expect(estimate.confidence).toBe("medium");
    expect(estimate.estimatedValue.low).toBeLessThanOrEqual(estimate.estimatedValue.expected);
    expect(estimate.estimatedValue.expected).toBeLessThanOrEqual(estimate.estimatedValue.high);
  });
});

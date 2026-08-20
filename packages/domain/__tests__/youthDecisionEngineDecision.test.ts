import { describe, expect, it } from "vitest";

import {
  assessYouthProspect,
  evaluateYouthDecisions,
  recommendYouthDecision,
  summarizeYouthDecisions,
  type CalibratedPlayerMarketValueEstimate,
  type PlayerMarketValueEstimate,
  type PlayerMarketValueProjection,
  type YouthDecisionContext,
  type YouthDevelopmentOpportunity,
  type YouthProspectAssessment
} from "@atlas/domain";

function player(
  overrides: Partial<YouthDecisionContext["player"]> = {}
): YouthDecisionContext["player"] {
  return {
    playerId: 1,
    age: 17,
    formation: "DEF",
    skills: { defender: 11, pace: 10, technique: 9, playmaker: 7 },
    ...overrides
  };
}

function prospect(
  playerInput = player(),
  overrides: Partial<YouthProspectAssessment> = {}
): YouthProspectAssessment {
  return { ...assessYouthProspect({ player: playerInput }), ...overrides };
}

function opportunity(
  overrides: Partial<YouthDevelopmentOpportunity> = {}
): YouthDevelopmentOpportunity {
  return {
    playerId: 1,
    profile: "central_defender",
    squadNeedScore: 0.72,
    successionFitScore: 0.7,
    developmentOpportunityScore: 0.72,
    resourceCompetitionScore: 0.18,
    clubFitScore: 0.76,
    opportunity: "good",
    confidence: "high",
    reasons: [{ type: "formation_training_viable" }],
    succession: null,
    advancedTraining: {
      projectedRank: 8,
      currentCutoffScore: 0.55,
      candidateScore: 0.82,
      opportunity: "likely"
    },
    reprofileOpportunity: null,
    developmentCapacity: null,
    ...overrides
  };
}

function marketValue(
  expected: number,
  confidence: PlayerMarketValueEstimate["confidence"] = "high"
): PlayerMarketValueEstimate {
  const range = { low: expected * 0.8, expected, high: expected * 1.2 };
  return {
    playerId: 1,
    estimatedValue: range,
    estimatedMarketValue: range,
    sokkerValue: null,
    marketToSokkerRatio: null,
    confidence,
    breakdown: {
      skillValue: expected,
      ageAdjustment: 0,
      profileAdjustment: 0,
      skillDistributionAdjustment: 0,
      developmentAdjustment: 0,
      rawValue: expected,
      finalValue: expected
    },
    reasons: []
  };
}

function calibratedMarketValue(
  expected: number,
  confidence: PlayerMarketValueEstimate["confidence"] = "high"
): CalibratedPlayerMarketValueEstimate {
  const fundamental = marketValue(expected, confidence);
  return {
    playerId: 1,
    fundamental,
    comparableEstimate: null,
    calibrationFactor: null,
    calibratedValue: fundamental.estimatedValue,
    confidence,
    calibrationStrength: 0,
    reasons: []
  };
}

function projection(
  current: number,
  projected: number,
  options: {
    confidence?: PlayerMarketValueProjection["confidence"];
    weeks?: number;
    averageValueGainPerWeek?: number;
  } = {}
): PlayerMarketValueProjection {
  const confidence = options.confidence ?? "high";
  const weeks = options.weeks ?? 20;
  return {
    playerId: 1,
    current: calibratedMarketValue(current, confidence),
    points: [],
    milestones: [],
    completion: {
      estimatedWeeks: weeks,
      estimatedGameWeek: 1220,
      estimatedDate: null,
      estimatedAge: 18,
      marketValue: {
        low: projected * 0.8,
        expected: projected,
        high: projected * 1.2
      },
      valueGain: projected - current,
      confidence
    },
    roi: {
      totalValueGain: projected - current,
      totalTrainingWeeks: weeks,
      averageValueGainPerWeek: options.averageValueGainPerWeek ?? (projected - current) / weeks,
      bestValueStep: null,
      diminishingReturnPoint: null,
      stepEvaluations: []
    },
    peak: { step: 1, age: 18, value: projected },
    confidence,
    reasons: [],
    modelVersion: "test"
  };
}

function context(overrides: Partial<YouthDecisionContext> = {}): YouthDecisionContext {
  const fitPlayer = overrides.player ?? player();
  return {
    player: fitPlayer,
    prospect: overrides.prospect ?? prospect(fitPlayer),
    opportunity: overrides.opportunity ?? opportunity({ playerId: fitPlayer.playerId }),
    ...overrides
  };
}

describe("Youth Decision Recommendations", () => {
  it("trains a high-quality prospect with excellent club fit", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.88, confidence: "high" }),
        opportunity: opportunity({ clubFitScore: 0.9, opportunity: "excellent" })
      })
    );

    expect(recommendation.decision).toBe("train");
    expect(recommendation.reasons).toContainEqual({ type: "elite_prospect" });
    expect(recommendation.reasons).toContainEqual({ type: "strong_club_fit" });
  });

  it("sells a good prospect when club fit is poor and market evidence is strong", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.82, confidence: "high" }),
        opportunity: opportunity({
          clubFitScore: 0.2,
          developmentOpportunityScore: 0.3,
          resourceCompetitionScore: 0.9,
          opportunity: "poor",
          reasons: [{ type: "profile_overstocked" }]
        }),
        marketValue: marketValue(2_000_000)
      })
    );

    expect(recommendation.decision).toBe("sell");
    expect(recommendation.reasons).toContainEqual({ type: "profile_overstocked" });
    expect(recommendation.reasons).toContainEqual({ type: "strong_market_value" });
  });

  it("keeps a medium prospect when formation development is viable", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.55, confidence: "high" }),
        opportunity: opportunity({ clubFitScore: 0.62, opportunity: "good" })
      })
    );

    expect(recommendation.decision).toBe("keep");
    expect(recommendation.reasons).toContainEqual({ type: "formation_development_viable" });
  });

  it("releases only a clearly weak player with high-confidence low economics", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), {
          prospectScore: 0.2,
          developmentPotentialScore: 0.2,
          confidence: "high"
        }),
        opportunity: opportunity({
          clubFitScore: 0.18,
          developmentOpportunityScore: 0.2,
          opportunity: "poor"
        }),
        marketValue: marketValue(10_000, "high")
      })
    );

    expect(recommendation.decision).toBe("release");
  });

  it("returns hold when essential evidence is missing", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: null, confidence: "low" }),
        opportunity: opportunity({ opportunity: "unknown", clubFitScore: null })
      })
    );

    expect(recommendation.decision).toBe("hold");
    expect(recommendation.reasons).toContainEqual({ type: "insufficient_evidence" });
  });

  it("does not release an excellent but congested prospect automatically", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.9, confidence: "high" }),
        opportunity: opportunity({
          clubFitScore: 0.18,
          developmentOpportunityScore: 0.25,
          resourceCompetitionScore: 0.95,
          opportunity: "poor",
          reasons: [{ type: "profile_overstocked" }]
        })
      })
    );

    expect(recommendation.decision).not.toBe("release");
  });

  it("prefers sell over release when a weak prospect still has material market value", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.2, confidence: "high" }),
        opportunity: opportunity({
          clubFitScore: 0.2,
          developmentOpportunityScore: 0.2,
          opportunity: "poor"
        }),
        marketValue: marketValue(1_500_000)
      })
    );

    expect(recommendation.decision).toBe("sell");
  });

  it("trains a succession candidate", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.8, confidence: "high" }),
        opportunity: opportunity({
          clubFitScore: 0.86,
          successionFitScore: 0.9,
          succession: {
            outgoingPlayerIds: [20],
            projectedReadyGameWeek: 1234,
            requiredReadyGameWeek: 1240,
            timingGapWeeks: -6,
            score: 0.9
          },
          opportunity: "excellent"
        })
      })
    );

    expect(recommendation.decision).toBe("train");
    expect(recommendation.reasons).toContainEqual({ type: "succession_candidate" });
  });

  it("raises train priority for an advanced candidate and keeps formation as a viable fallback", () => {
    const advanced = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.84, confidence: "high" }),
        opportunity: opportunity({ clubFitScore: 0.84, opportunity: "excellent" })
      })
    );
    const formation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.72, confidence: "high" }),
        opportunity: opportunity({
          clubFitScore: 0.7,
          opportunity: "good",
          advancedTraining: {
            projectedRank: 14,
            currentCutoffScore: 0.8,
            candidateScore: 0.55,
            opportunity: "unlikely"
          },
          reasons: [{ type: "formation_training_viable" }]
        })
      })
    );

    expect(advanced.decision).toBe("train");
    expect(advanced.priority).toBe("high");
    expect(advanced.reasons).toContainEqual({ type: "advanced_training_candidate" });
    expect(formation.decision).toBe("train");
    expect(formation.risks).toContainEqual({ type: "advanced_slot_unlikely" });
  });

  it("allows exceptional development value creation to justify training", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.75, confidence: "high" }),
        opportunity: opportunity({
          clubFitScore: 0.3,
          developmentOpportunityScore: 0.62,
          resourceCompetitionScore: 0.05,
          opportunity: "limited"
        }),
        marketValue: marketValue(300_000),
        marketProjection: projection(300_000, 5_000_000, {
          weeks: 16,
          averageValueGainPerWeek: 295_000
        })
      })
    );

    expect(recommendation.decision).toBe("train");
    expect(recommendation.reasons).toContainEqual({ type: "high_development_value_creation" });
    expect(recommendation.scores.economicOpportunity).not.toBeNull();
  });

  it("does not let weak economics override a strong sporting training path", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.86, confidence: "high" }),
        opportunity: opportunity({ clubFitScore: 0.9, developmentOpportunityScore: 0.9 }),
        marketValue: marketValue(50_000),
        marketProjection: projection(50_000, 55_000, { averageValueGainPerWeek: 250 })
      })
    );

    expect(recommendation.decision).toBe("train");
  });

  it("uses a viable alternative profile for training without mutating the current profile", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.78, confidence: "high" }),
        opportunity: opportunity({
          profile: "winger",
          clubFitScore: 0.25,
          opportunity: "poor",
          reprofileOpportunity: {
            currentProfile: "winger",
            alternativeProfile: "central_midfielder",
            compatibilityScore: 0.82,
            squadNeedImprovement: 0.3,
            viable: true
          }
        })
      })
    );

    expect(recommendation.decision).toBe("train");
    expect(recommendation.recommendedProfile).toBe("central_midfielder");
    expect(recommendation.reasons).toContainEqual({
      type: "better_alternative_profile",
      profile: "central_midfielder"
    });
  });

  it("does not change profile for a weak reprofile suggestion", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.78, confidence: "high" }),
        opportunity: opportunity({
          clubFitScore: 0.8,
          reprofileOpportunity: {
            currentProfile: "central_defender",
            alternativeProfile: "central_midfielder",
            compatibilityScore: 0.55,
            squadNeedImprovement: 0.02,
            viable: false
          }
        })
      })
    );

    expect(recommendation.recommendedProfile).toBe("central_defender");
    expect(recommendation.alternativeProfile).toBeNull();
  });

  it("lowers resource efficiency under strong competition without changing prospect quality", () => {
    const prospectAssessment = prospect(player(), { prospectScore: 0.74, confidence: "high" });
    const open = recommendYouthDecision(
      context({
        prospect: prospectAssessment,
        opportunity: opportunity({ resourceCompetitionScore: 0.05 })
      })
    );
    const congested = recommendYouthDecision(
      context({
        prospect: prospectAssessment,
        opportunity: opportunity({
          resourceCompetitionScore: 0.95,
          clubFitScore: 0.5,
          opportunity: "limited"
        })
      })
    );

    expect(congested.scores.resourceEfficiency).toBeLessThan(open.scores.resourceEfficiency ?? 1);
    expect(congested.scores.prospectQuality).toBe(open.scores.prospectQuality);
  });

  it("reduces confidence for uncertain market evidence and missing market data", () => {
    const uncertain = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.8, confidence: "high" }),
        opportunity: opportunity({ clubFitScore: 0.8 }),
        marketValue: marketValue(1_000_000, "low")
      })
    );
    const missing = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.8, confidence: "high" }),
        opportunity: opportunity({ clubFitScore: 0.8 })
      })
    );

    expect(uncertain.confidence).toBe("low");
    expect(missing.confidence).toBe("low");
  });

  it("applies decision stability when a borderline recommendation changes without material evidence", () => {
    const initial = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.72, confidence: "medium" }),
        opportunity: opportunity({ clubFitScore: 0.7, confidence: "medium" })
      })
    );
    const stabilized = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.67, confidence: "medium" }),
        opportunity: opportunity({
          clubFitScore: 0.65,
          opportunity: "good",
          confidence: "medium"
        }),
        previousDecision: initial
      })
    );

    expect(initial.decision).toBe("train");
    expect(stabilized.decision).toBe("train");
  });

  it("ranks decisions independently from prospect quality and summarizes the queue", () => {
    const highQualityPoorFit = context({
      player: player({ playerId: 1 }),
      prospect: prospect(player({ playerId: 1 }), { prospectScore: 0.9, confidence: "high" }),
      opportunity: opportunity({
        playerId: 1,
        clubFitScore: 0.2,
        developmentOpportunityScore: 0.2,
        opportunity: "poor"
      }),
      marketValue: marketValue(2_000_000)
    });
    const mediumQualityGoodFit = context({
      player: player({ playerId: 2 }),
      prospect: prospect(player({ playerId: 2 }), { prospectScore: 0.7, confidence: "high" }),
      opportunity: opportunity({ playerId: 2, clubFitScore: 0.85, opportunity: "excellent" })
    });
    const recommendations = evaluateYouthDecisions([highQualityPoorFit, mediumQualityGoodFit]);
    const summary = summarizeYouthDecisions(recommendations);

    expect(recommendations.map((item) => item.decision)).toEqual(["train", "sell"]);
    expect(recommendations[0]?.playerId).toBe(2);
    expect(summary.counts.train).toBe(1);
    expect(summary.counts.sell).toBe(1);
  });

  it("uses a deterministic player id tie-breaker and does not mutate context inputs", () => {
    const advancedTraining = {
      projectedRank: 8,
      currentCutoffScore: 0.55,
      candidateScore: 0.82,
      opportunity: "likely" as const
    };
    const input = context({ advancedTraining: undefined });
    const before = JSON.stringify(input);
    const first = evaluateYouthDecisions([
      context({
        player: player({ playerId: 2 }),
        prospect: prospect(player({ playerId: 2 })),
        opportunity: opportunity({ playerId: 2 })
      }),
      context({
        player: player({ playerId: 1 }),
        prospect: prospect(player({ playerId: 1 })),
        opportunity: opportunity({ playerId: 1 })
      })
    ]);
    const second = evaluateYouthDecisions([
      context({
        player: player({ playerId: 1 }),
        prospect: prospect(player({ playerId: 1 })),
        opportunity: opportunity({ playerId: 1 })
      }),
      context({
        player: player({ playerId: 2 }),
        prospect: prospect(player({ playerId: 2 })),
        opportunity: opportunity({ playerId: 2 })
      })
    ]);

    expect(first.map((item) => item.playerId)).toEqual([1, 2]);
    expect(second.map((item) => item.playerId)).toEqual([1, 2]);
    expect(JSON.stringify(input)).toBe(before);
    expect(advancedTraining.opportunity).toBe("likely");
  });

  it("never emits non-finite scores for partial market projections", () => {
    const recommendation = recommendYouthDecision(
      context({
        prospect: prospect(player(), { prospectScore: 0.6, confidence: "medium" }),
        opportunity: opportunity({ clubFitScore: 0.55, developmentOpportunityScore: 0.55 }),
        marketProjection: projection(0, 0, { weeks: 0, averageValueGainPerWeek: 0 })
      })
    );

    for (const value of Object.values(recommendation.scores)) {
      expect(value === null || Number.isFinite(value)).toBe(true);
    }
  });
});

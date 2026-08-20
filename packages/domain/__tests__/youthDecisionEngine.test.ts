import { describe, expect, it } from "vitest";

import {
  assessYouthProspect,
  assessYouthProspects,
  buildYouthProspectDiagnostic,
  suggestDevelopmentProfile,
  type DevelopmentPlayer,
  type TalentEstimate,
  type YouthProspectContext
} from "@atlas/domain";

function player(overrides: Partial<DevelopmentPlayer> = {}): DevelopmentPlayer {
  return {
    playerId: 1,
    age: 17,
    formation: "DEF",
    skills: {
      stamina: 7,
      pace: 10,
      technique: 8,
      passing: 6,
      keeper: 1,
      defender: 11,
      playmaker: 7,
      striker: 3
    },
    ...overrides
  };
}

function talent(value: number, confidence: TalentEstimate["confidence"] = "high"): TalentEstimate {
  return { value, confidence, evidenceCount: 3, evidences: [] };
}

function context(overrides: Partial<YouthProspectContext> = {}): YouthProspectContext {
  return { player: player(), ...overrides };
}

describe("Youth Decision Engine: Youth Prospect Assessment", () => {
  it("scores a young player with strong primary skills as a good prospect", () => {
    const assessment = assessYouthProspect(context({ talent: talent(1.2) }));

    expect(assessment.suggestedProfile).toBe("central_defender");
    expect(assessment.prospectScore).toBeGreaterThan(0.5);
    expect(assessment.strengths).toContainEqual({
      type: "strong_primary_skill",
      skill: "defender",
      level: 11
    });
  });

  it("adjusts otherwise equal skillsets continuously for age", () => {
    const young = assessYouthProspect(context({ player: player({ age: 17 }) }));
    const older = assessYouthProspect(context({ player: player({ age: 19 }) }));

    expect(young.currentQualityScore).toBeGreaterThan(older.currentQualityScore ?? 0);
    expect(young.developmentPotentialScore).toBeGreaterThan(older.developmentPotentialScore ?? 0);
  });

  it("rewards a coherent profile over a similarly averaged but scattered distribution", () => {
    const coherent = assessYouthProspect(
      context({
        player: player({
          skills: { defender: 10, pace: 9, technique: 8, playmaker: 7 }
        }),
        suggestedDevelopmentProfile: {
          profile: "central_defender",
          confidence: "medium",
          reasons: []
        }
      })
    );
    const scattered = assessYouthProspect(
      context({
        player: player({
          skills: { defender: 6, striker: 10, passing: 9, keeper: 7 }
        })
      })
    );

    expect(coherent.profileCoherenceScore).toBeGreaterThan(scattered.profileCoherenceScore ?? 0);
    expect(coherent.prospectScore).toBeGreaterThan(scattered.prospectScore ?? 0);
  });

  it("lowers coherence and confidence when the profile is unclear", () => {
    const assessment = assessYouthProspect(
      context({ player: player({ formation: null, skills: { stamina: 8 } }) })
    );

    expect(assessment.suggestedProfile).toBeNull();
    expect(assessment.profileCoherenceScore).toBeNull();
    expect(assessment.confidence).toBe("low");
    expect(assessment.weaknesses).toContainEqual({ type: "unclear_profile" });
  });

  it("uses reliable high talent to increase potential", () => {
    const withoutTalent = assessYouthProspect(context());
    const highTalent = assessYouthProspect(context({ talent: talent(1.4, "high") }));

    expect(highTalent.developmentPotentialScore).toBeGreaterThan(
      withoutTalent.developmentPotentialScore ?? 0
    );
  });

  it("limits the impact of low-confidence talent", () => {
    const baseline = assessYouthProspect(context());
    const lowConfidence = assessYouthProspect(context({ talent: talent(1.4, "low") }));

    expect(
      Math.abs(
        (lowConfidence.developmentPotentialScore ?? 0) - (baseline.developmentPotentialScore ?? 0)
      )
    ).toBeLessThan(0.05);
  });

  it("does not require talent to produce a partial assessment", () => {
    const assessment = assessYouthProspect(context({ talent: null }));

    expect(assessment.prospectScore).not.toBeNull();
    expect(assessment.confidence).toBe("medium");
  });

  it("uses the goalkeeper profile and field-specific keeper skill", () => {
    const assessment = assessYouthProspect(
      context({
        player: player({
          formation: "GK",
          skills: { keeper: 13, pace: 8, passing: 7, defender: 2, striker: 3 }
        })
      })
    );

    expect(assessment.suggestedProfile).toBe("goalkeeper");
    expect(assessment.strengths).toContainEqual({
      type: "strong_primary_skill",
      skill: "keeper",
      level: 13
    });
  });

  it("uses the same profile detector as Player Development", () => {
    const developmentSuggestion = suggestDevelopmentProfile(player());
    const assessment = assessYouthProspect(context());

    expect(assessment.suggestedProfile).toBe(developmentSuggestion.profile);
  });

  it("generates an automatic target without persisting a decision", () => {
    const assessment = assessYouthProspect(context());

    expect(assessment.suggestedDevelopmentTarget).toMatchObject({
      playerId: 1,
      profile: "central_defender",
      source: "automatic"
    });
    expect(assessment.suggestedDevelopmentTarget?.targetSkills.map(({ skill }) => skill)).toEqual([
      "defender",
      "pace",
      "technique",
      "playmaker"
    ]);
  });

  it("supports disabling the derived target", () => {
    const assessment = assessYouthProspect(context({ includeSuggestedDevelopmentTarget: false }));

    expect(assessment.suggestedDevelopmentTarget).toBeNull();
  });

  it("ranks prospects by score and breaks ties by player id", () => {
    const assessments = assessYouthProspects([
      context({ player: player({ playerId: 3, age: 19 }) }),
      context({ player: player({ playerId: 1, age: 17 }) }),
      context({ player: player({ playerId: 2, age: 17 }) })
    ]);

    expect(assessments.map(({ playerId }) => playerId)).toEqual([1, 2, 3]);
    expect(
      assessYouthProspects([
        ...[
          context({ player: player({ playerId: 2, age: 17 }) }),
          context({ player: player({ playerId: 1, age: 17 }) })
        ]
      ]).map(({ playerId }) => playerId)
    ).toEqual([1, 2]);
  });

  it("returns a partial result for incomplete skills and invalid age", () => {
    const assessment = assessYouthProspect(
      context({ player: player({ age: 15, skills: { defender: 9, pace: null } }) })
    );

    expect(assessment.currentQualityScore).not.toBeNull();
    expect(assessment.prospectScore).not.toBeNull();
    expect(assessment.confidence).toBe("low");
    expect(assessment.reasons).toContainEqual({ type: "invalid_age" });
    expect(assessment.reasons).toContainEqual(
      expect.objectContaining({ type: "incomplete_skills" })
    );
  });

  it("never emits NaN or Infinity and exposes calibration diagnostics", () => {
    const assessment = assessYouthProspect(
      context({
        player: player({ age: Number.NaN, skills: { defender: Number.POSITIVE_INFINITY } })
      })
    );
    const diagnostic = buildYouthProspectDiagnostic(context());
    const values = [
      assessment.currentQualityScore,
      assessment.developmentPotentialScore,
      assessment.profileCoherenceScore,
      assessment.prospectScore
    ];

    expect(values.every((value) => value === null || Number.isFinite(value))).toBe(true);
    expect(diagnostic).toMatchObject({ playerId: 1, profile: "central_defender" });
  });

  it("emits semantic weaknesses for low primary skills and unbalanced distribution", () => {
    const assessment = assessYouthProspect(
      context({
        player: player({
          skills: { defender: 5, striker: 12, passing: 10, keeper: 10, stamina: 10 }
        }),
        suggestedDevelopmentProfile: {
          profile: "central_defender",
          confidence: "medium",
          reasons: []
        }
      })
    );

    expect(assessment.weaknesses).toContainEqual({ type: "low_primary_skills" });
    expect(assessment.weaknesses).toContainEqual({ type: "unbalanced_skill_distribution" });
  });
});

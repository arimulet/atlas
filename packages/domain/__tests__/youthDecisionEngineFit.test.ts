import { describe, expect, it } from "vitest";

import {
  assessYouthDevelopmentOpportunity,
  assessYouthProspect,
  evaluateYouthDevelopmentOpportunities,
  type PlayerDevelopmentProjection,
  type ProfileDepthAssessment,
  type SquadAssessment,
  type SquadDepthAnalysis,
  type YouthFitContext,
  type YouthProspectAssessment
} from "@atlas/domain";

function player(overrides: Partial<YouthFitContext["player"]> = {}): YouthFitContext["player"] {
  return {
    playerId: 1,
    age: 17,
    formation: "DEF",
    skills: { defender: 11, pace: 10, technique: 9, playmaker: 7 },
    ...overrides
  };
}

function prospect(playerInput = player()): YouthProspectAssessment {
  return assessYouthProspect({ player: playerInput });
}

function squadAssessment(): SquadAssessment {
  return {
    players: [],
    summary: { core: 0, developing: 0, prospect: 0, rotation: 0, depth: 0, transition: 0 }
  };
}

function depthProfile(overrides: Partial<ProfileDepthAssessment> = {}): ProfileDepthAssessment {
  return {
    profile: "defender",
    requirement: { profile: "defender", minimum: 2, ideal: 3, maximum: 4 },
    current: {
      availablePlayers: 2,
      strongOptions: 2,
      developingOptions: 0,
      prospects: 0,
      playerIds: [10, 11],
      depthScore: 0.7
    },
    nextSeason: {
      availablePlayers: 2,
      strongOptions: 2,
      developingOptions: 0,
      prospects: 0,
      playerIds: [10, 11],
      depthScore: 0.7
    },
    mediumTerm: {
      availablePlayers: 2,
      strongOptions: 2,
      developingOptions: 0,
      prospects: 0,
      playerIds: [10, 11],
      depthScore: 0.7
    },
    succession: {
      successionRequired: false,
      outgoingPlayers: [],
      successorCandidates: [],
      coverageStatus: "covered"
    },
    status: "balanced",
    confidence: "high",
    dependencyRisk: null,
    reasons: [{ type: "healthy_depth" }],
    ...overrides
  };
}

function depth(overrides: Partial<ProfileDepthAssessment> = {}): SquadDepthAnalysis {
  const profile = depthProfile(overrides);
  return {
    profiles: [profile],
    summary: {
      criticalProfiles: profile.status === "critical" ? 1 : 0,
      thinProfiles: profile.status === "thin" ? 1 : 0,
      balancedProfiles: profile.status === "balanced" ? 1 : 0,
      deepProfiles: profile.status === "deep" ? 1 : 0,
      overstockedProfiles: profile.status === "overstocked" ? 1 : 0,
      missingSuccessions: profile.succession.coverageStatus === "missing" ? 1 : 0,
      dependencyRisks: profile.dependencyRisk ? 1 : 0
    }
  };
}

function projection(
  overrides: Partial<PlayerDevelopmentProjection["completion"]> = {}
): PlayerDevelopmentProjection {
  return {
    playerId: 1,
    profile: "defender",
    generatedAtGameWeek: 1200,
    generatedAtDate: new Date("2026-08-20T00:00:00.000Z"),
    steps: [],
    milestones: [],
    completion: {
      estimatedWeeks: 20,
      estimatedGameWeek: 1220,
      estimatedDate: null,
      estimatedAge: 18,
      ...overrides
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

function context(overrides: Partial<YouthFitContext> = {}): YouthFitContext {
  const fitPlayer = overrides.player ?? player();
  return {
    player: fitPlayer,
    prospectAssessment: overrides.prospectAssessment ?? prospect(fitPlayer),
    squadAssessment: squadAssessment(),
    depthAnalysis: depth(),
    developmentProjection: projection(),
    currentGameWeek: 1200,
    ...overrides
  };
}

function advanced(rank: number, score: number): NonNullable<YouthFitContext["advancedTraining"]> {
  return {
    gameWeek: 1200,
    slotCount: 10,
    ranking: [
      {
        playerId: 1,
        rank,
        score,
        currentlyAdvanced: false,
        recommendedAdvanced: rank <= 10,
        confidence: "high"
      }
    ],
    recommendedAdvancedPlayerIds: rank <= 10 ? [1] : [],
    recommendations: [],
    replacements: [],
    summary: { currentlyAdvanced: 0, recommendedChanges: 0, promotions: 0, removals: 0 }
  };
}

describe("Youth Fit & Development Opportunity", () => {
  it("raises squad need for a critical profile", () => {
    const assessment = assessYouthDevelopmentOpportunity(
      context({
        depthAnalysis: depth({
          status: "critical",
          current: { ...depthProfile().current, strongOptions: 0, developingOptions: 0 },
          nextSeason: { ...depthProfile().nextSeason, strongOptions: 0, developingOptions: 0 },
          mediumTerm: { ...depthProfile().mediumTerm, strongOptions: 0, developingOptions: 1 },
          succession: {
            ...depthProfile().succession,
            successionRequired: true,
            coverageStatus: "missing"
          },
          reasons: [
            { type: "below_minimum_depth", current: 0, minimum: 2 },
            { type: "missing_successor" }
          ]
        }),
        squadRecommendations: {
          recommendations: [
            {
              id: "need",
              type: "prepare_successor",
              profile: "defender",
              priority: "high",
              horizon: "medium_term",
              playerIds: [],
              confidence: "high",
              reasons: [{ type: "missing_successor" }]
            }
          ],
          conflicts: [],
          summary: {
            critical: 0,
            high: 1,
            medium: 0,
            low: 0,
            profilesNeedingExternalHelp: 0,
            profilesWithInternalSolutions: 1,
            profilesOverstocked: 0
          }
        }
      })
    );

    expect(assessment.squadNeedScore).toBeGreaterThan(0.7);
    expect(assessment.reasons).toContainEqual({
      type: "profile_needed",
      profile: "defender",
      horizon: "current"
    });
  });

  it("reduces fit for an overstocked profile without changing prospect quality", () => {
    const prospectAssessment = prospect();
    const contextWithDepth = context({ prospectAssessment });
    const overstocked = assessYouthDevelopmentOpportunity(contextWithDepth, {
      goodClubFitThreshold: 0.1
    });
    const changed = assessYouthDevelopmentOpportunity(
      context({
        prospectAssessment,
        depthAnalysis: depth({
          status: "overstocked",
          current: { ...depthProfile().current, strongOptions: 5, availablePlayers: 5 },
          nextSeason: { ...depthProfile().nextSeason, strongOptions: 5, availablePlayers: 5 },
          mediumTerm: { ...depthProfile().mediumTerm, strongOptions: 5, availablePlayers: 5 },
          reasons: [{ type: "overstocked_profile" }]
        })
      })
    );

    expect(prospectAssessment.prospectScore).toBe(
      contextWithDepth.prospectAssessment.prospectScore
    );
    expect(changed.clubFitScore).toBeLessThan(overstocked.clubFitScore ?? 1);
    expect(changed.reasons).toContainEqual({ type: "profile_overstocked" });
  });

  it("rewards missing succession when the youth is projected to arrive on time", () => {
    const assessment = assessYouthDevelopmentOpportunity(
      context({
        requiredReadyGameWeek: 1240,
        developmentProjection: projection({ estimatedGameWeek: 1234 }),
        depthAnalysis: depth({
          succession: {
            successionRequired: true,
            outgoingPlayers: [10],
            successorCandidates: [],
            coverageStatus: "missing"
          }
        })
      })
    );

    expect(assessment.successionFitScore).toBeGreaterThan(0.8);
    expect(assessment.reasons).toContainEqual({ type: "projected_ready_in_time" });
    expect(assessment.reasons).toContainEqual({
      type: "succession_opportunity",
      profile: "defender"
    });
  });

  it("lowers succession fit when readiness is too late", () => {
    const onTime = assessYouthDevelopmentOpportunity(
      context({
        requiredReadyGameWeek: 1240,
        developmentProjection: projection({ estimatedGameWeek: 1234 })
      })
    );
    const late = assessYouthDevelopmentOpportunity(
      context({
        requiredReadyGameWeek: 1240,
        developmentProjection: projection({ estimatedGameWeek: 1260 })
      })
    );

    expect(late.successionFitScore).toBeLessThan(onTime.successionFitScore ?? 1);
    expect(late.reasons).toContainEqual({ type: "projected_ready_too_late" });
  });

  it("reduces succession fit when an existing successor is better", () => {
    const noCompetitor = assessYouthDevelopmentOpportunity(
      context({
        depthAnalysis: depth({
          succession: {
            successionRequired: true,
            outgoingPlayers: [10],
            successorCandidates: [],
            coverageStatus: "missing"
          }
        })
      })
    );
    const betterSuccessor = assessYouthDevelopmentOpportunity(
      context({
        depthAnalysis: depth({
          succession: {
            successionRequired: true,
            outgoingPlayers: [10],
            successorCandidates: [
              {
                playerId: 20,
                predecessorPlayerId: 10,
                readiness: "developing",
                estimatedReadyGameWeek: 1220,
                currentContributionScore: 0.7,
                futureContributionScore: 0.95,
                confidence: "high"
              }
            ],
            coverageStatus: "covered"
          }
        })
      })
    );

    expect(betterSuccessor.successionFitScore).toBeLessThan(noCompetitor.successionFitScore ?? 1);
  });

  it("models development congestion as negative fit", () => {
    const lowCompetition = assessYouthDevelopmentOpportunity(context());
    const congested = assessYouthDevelopmentOpportunity(
      context({
        depthAnalysis: depth({
          mediumTerm: { ...depthProfile().mediumTerm, prospects: 5, developingOptions: 2 },
          reasons: [{ type: "development_congestion", candidates: 7 }]
        })
      })
    );

    expect(congested.resourceCompetitionScore).toBeGreaterThan(
      lowCompetition.resourceCompetitionScore ?? 0
    );
    expect(congested.clubFitScore).toBeLessThan(lowCompetition.clubFitScore ?? 1);
    expect(congested.reasons).toContainEqual({ type: "development_congestion" });
  });

  it("distinguishes likely and unlikely advanced training without making unlikely equal to no development", () => {
    const likely = assessYouthDevelopmentOpportunity(
      context({ advancedTraining: advanced(8, 0.8) })
    );
    const unlikely = assessYouthDevelopmentOpportunity(
      context({ advancedTraining: advanced(14, 0.3) })
    );

    expect(likely.advancedTraining?.opportunity).toBe("likely");
    expect(unlikely.advancedTraining?.opportunity).toBe("unlikely");
    expect(unlikely.developmentOpportunityScore).not.toBeNull();
    expect(unlikely.opportunity).not.toBe("poor");
  });

  it("keeps formation training viable when advanced opportunity is unavailable", () => {
    const assessment = assessYouthDevelopmentOpportunity(
      context({
        advancedTraining: null,
        developmentProjection: {
          ...projection(),
          assumptions: { ...projection().assumptions, trainingKind: "formation" }
        }
      })
    );

    expect(assessment.reasons).toContainEqual({ type: "formation_training_viable" });
    expect(assessment.developmentOpportunityScore).toBeGreaterThan(0);
  });

  it("weights future need more strongly than an urgent current gap", () => {
    const currentGap = assessYouthDevelopmentOpportunity(
      context({
        depthAnalysis: depth({
          status: "critical",
          current: { ...depthProfile().current, strongOptions: 0 },
          nextSeason: { ...depthProfile().nextSeason, strongOptions: 2 },
          mediumTerm: { ...depthProfile().mediumTerm, strongOptions: 3 }
        }),
        requiredReadyGameWeek: 1201,
        developmentProjection: projection({ estimatedGameWeek: 1220 })
      })
    );
    const futureGap = assessYouthDevelopmentOpportunity(
      context({
        depthAnalysis: depth({
          current: { ...depthProfile().current, strongOptions: 2 },
          nextSeason: { ...depthProfile().nextSeason, strongOptions: 1 },
          mediumTerm: { ...depthProfile().mediumTerm, strongOptions: 0 },
          status: "thin"
        })
      })
    );

    expect(futureGap.squadNeedScore).toBeGreaterThan(currentGap.squadNeedScore ?? 0);
    expect(currentGap.reasons).toContainEqual({ type: "current_gap_not_solved_immediately" });
  });

  it("returns unknown with low confidence when squad context or projection is missing", () => {
    const missingSquad = assessYouthDevelopmentOpportunity(
      context({ depthAnalysis: null, squadAssessment: null })
    );
    const missingProjection = assessYouthDevelopmentOpportunity(
      context({ developmentProjection: null })
    );

    expect(missingSquad.opportunity).toBe("unknown");
    expect(missingSquad.confidence).toBe("low");
    expect(missingProjection.opportunity).toBe("unknown");
    expect(missingProjection.reasons).toContainEqual({ type: "missing_development_projection" });
  });

  it("supports reprofile opportunities only when the alternative is compatible and needed", () => {
    const assessment = assessYouthDevelopmentOpportunity(
      context({
        player: player({
          skills: { defender: 10, pace: 12, technique: 11, passing: 8, playmaker: 7 }
        }),
        depthAnalysis: {
          profiles: [
            depthProfile({ status: "overstocked" }),
            depthProfile({
              profile: "wing_defender",
              requirement: { profile: "wing_defender", minimum: 2, ideal: 3, maximum: 4 },
              status: "thin",
              current: { ...depthProfile().current, strongOptions: 0 },
              nextSeason: { ...depthProfile().nextSeason, strongOptions: 0 },
              mediumTerm: { ...depthProfile().mediumTerm, strongOptions: 0 }
            })
          ],
          summary: {
            criticalProfiles: 0,
            thinProfiles: 1,
            balancedProfiles: 0,
            deepProfiles: 0,
            overstockedProfiles: 1,
            missingSuccessions: 0,
            dependencyRisks: 0
          }
        }
      })
    );

    expect(assessment.reprofileOpportunity?.alternativeProfile).toBe("wing_defender");
    expect(assessment.reprofileOpportunity?.viable).toBe(true);
  });

  it("does not create a reprofile opportunity for a weak alternative", () => {
    const assessment = assessYouthDevelopmentOpportunity(
      context({
        player: player({ skills: { defender: 11, pace: 4, technique: 4 } }),
        depthAnalysis: depth({ status: "overstocked" })
      })
    );

    expect(assessment.reprofileOpportunity).toBeNull();
  });

  it("evaluates goalkeeper succession through the goalkeeper profile", () => {
    const goalkeeper = player({
      formation: "GK",
      skills: { keeper: 13, pace: 8, passing: 7, defender: 2 }
    });
    const goalkeeperProspect = prospect(goalkeeper);
    const goalkeeperDepth = depthProfile({
      profile: "goalkeeper",
      requirement: { profile: "goalkeeper", minimum: 1, ideal: 2, maximum: 3 },
      succession: {
        successionRequired: true,
        outgoingPlayers: [50],
        successorCandidates: [],
        coverageStatus: "missing"
      }
    });
    const assessment = assessYouthDevelopmentOpportunity(
      context({
        player: goalkeeper,
        prospectAssessment: goalkeeperProspect,
        depthAnalysis: {
          profiles: [goalkeeperDepth],
          summary: {
            criticalProfiles: 0,
            thinProfiles: 0,
            balancedProfiles: 1,
            deepProfiles: 0,
            overstockedProfiles: 0,
            missingSuccessions: 1,
            dependencyRisks: 0
          }
        }
      })
    );

    expect(assessment.profile).toBe("goalkeeper");
    expect(assessment.succession?.outgoingPlayerIds).toEqual([50]);
    expect(assessment.reasons).toContainEqual({
      type: "succession_opportunity",
      profile: "goalkeeper"
    });
  });

  it("exposes marginal capacity after hypothetical inclusion without mutating depth", () => {
    const original = context();
    const before = structuredClone(original.depthAnalysis);
    const assessment = assessYouthDevelopmentOpportunity(original);

    expect(assessment.developmentCapacity).toMatchObject({ youthCandidateIncluded: true });
    expect(original.depthAnalysis).toEqual(before);
  });

  it("keeps club-fit ranking separate from prospect ranking and deterministic", () => {
    const first = context({ player: player({ playerId: 1 }) });
    const second = context({
      player: player({ playerId: 2 }),
      depthAnalysis: depth({
        status: "critical",
        current: { ...depthProfile().current, strongOptions: 0 }
      })
    });
    const ranked = evaluateYouthDevelopmentOpportunities([first, second]);
    const reversed = evaluateYouthDevelopmentOpportunities([second, first]);

    expect(ranked.map(({ playerId }) => playerId)).toEqual([2, 1]);
    expect(reversed).toEqual(ranked);
    expect(first.prospectAssessment.prospectScore).toBe(second.prospectAssessment.prospectScore);
    expect(ranked[0]?.opportunity).not.toBe("poor");
  });

  it("does not expose final KEEP/TRAIN/SELL/RELEASE decisions", () => {
    const assessment = assessYouthDevelopmentOpportunity(context());

    expect(assessment).not.toHaveProperty("decision");
    expect(JSON.stringify(assessment)).not.toMatch(/KEEP|TRAIN|SELL|RELEASE/);
  });
});

import { describe, expect, it } from "vitest";

import {
  analyzeSquadDepth,
  generateSquadPlanningRecommendations,
  type PlayerDevelopmentProjection,
  type SquadDepthPlayer,
  type SquadPlanningRecommendations,
  type SquadProfileRequirement
} from "@atlas/domain";

const forwardRequirement: SquadProfileRequirement = {
  profile: "forward",
  minimum: 2,
  ideal: 3,
  maximum: 4
};

const midfielderRequirement: SquadProfileRequirement = {
  profile: "midfielder",
  minimum: 2,
  ideal: 3,
  maximum: 4
};

function player(overrides: Partial<SquadDepthPlayer> = {}): SquadDepthPlayer {
  const role = overrides.role ?? "rotation";
  return {
    playerId: overrides.playerId ?? 1,
    role,
    automaticRole: overrides.automaticRole ?? role,
    source: "automatic",
    manualRole: null,
    lifecycle: overrides.lifecycle ?? "prime",
    profile: overrides.profile ?? "forward",
    currentContributionScore: overrides.currentContributionScore ?? 0.6,
    futureContributionScore: overrides.futureContributionScore ?? 0.6,
    developmentPotentialScore: overrides.developmentPotentialScore ?? null,
    currentContributionPercentile: null,
    confidence: overrides.confidence ?? "high",
    reasons: [],
    ...overrides
  };
}

function projection(playerId: number, estimatedWeeks: number): PlayerDevelopmentProjection {
  return {
    playerId,
    profile: "forward",
    generatedAtGameWeek: 1200,
    generatedAtDate: new Date("2026-08-20T00:00:00.000Z"),
    steps: [],
    milestones: [],
    completion: {
      estimatedWeeks,
      estimatedGameWeek: 1200 + estimatedWeeks,
      estimatedDate: null,
      estimatedAge: null
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

function analyze(
  players: readonly SquadDepthPlayer[],
  requirements: readonly SquadProfileRequirement[] = [forwardRequirement]
) {
  return analyzeSquadDepth(players, {
    requirements,
    currentGameWeek: 1200
  });
}

function recommend(
  players: readonly SquadDepthPlayer[],
  requirements: readonly SquadProfileRequirement[] = [forwardRequirement],
  previous?: SquadPlanningRecommendations | null
) {
  const depthAnalysis = analyze(players, requirements);
  return generateSquadPlanningRecommendations({
    depthAnalysis,
    players,
    previous
  });
}

function recommendationFor(result: ReturnType<typeof recommend>, profile = "forward") {
  return result.recommendations.find((recommendation) => recommendation.profile === profile)!;
}

describe("squad planning recommendations", () => {
  it("emits maintain for a balanced and healthy profile", () => {
    const result = recommend([
      player({
        playerId: 1,
        role: "core",
        currentContributionScore: 0.85,
        futureContributionScore: 0.85
      }),
      player({
        playerId: 2,
        role: "core",
        currentContributionScore: 0.82,
        futureContributionScore: 0.82
      }),
      player({
        playerId: 3,
        role: "rotation",
        currentContributionScore: 0.78,
        futureContributionScore: 0.8
      })
    ]);

    expect(recommendationFor(result)).toMatchObject({ type: "maintain", priority: "low" });
  });

  it("finds an external solution for a current critical gap", () => {
    const result = recommend([
      player({ currentContributionScore: 0.3, futureContributionScore: 0.3 })
    ]);

    expect(recommendationFor(result)).toMatchObject({
      type: "find_external",
      priority: "critical",
      horizon: "current",
      playerIds: [],
      need: { profile: "forward", horizon: "current", priority: "critical" }
    });
  });

  it("develops an internal successor for a future gap", () => {
    const result = recommend(
      [
        player({
          playerId: 10,
          role: "core",
          lifecycle: "late_prime",
          currentContributionScore: 0.85,
          futureContributionScore: 0.3
        }),
        player({
          playerId: 11,
          role: "core",
          lifecycle: "late_prime",
          currentContributionScore: 0.84,
          futureContributionScore: 0.3
        }),
        player({
          playerId: 20,
          role: "developing",
          lifecycle: "development",
          currentContributionScore: 0.55,
          futureContributionScore: 0.85,
          projection: projection(20, 10)
        }),
        player({
          playerId: 30,
          role: "core",
          currentContributionScore: 0.82,
          futureContributionScore: 0.82
        }),
        player({
          playerId: 40,
          role: "core",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        })
      ],
      [{ ...forwardRequirement, minimum: 4, ideal: 4, maximum: 5 }]
    );

    expect(recommendationFor(result)).toMatchObject({
      type: "develop_internal",
      horizon: "next_season",
      playerIds: [20]
    });
  });

  it("accelerates a successor that is projected just behind the needed horizon", () => {
    const result = recommend(
      [
        player({
          playerId: 10,
          role: "core",
          lifecycle: "late_prime",
          currentContributionScore: 0.85,
          futureContributionScore: 0.3
        }),
        player({
          playerId: 11,
          role: "core",
          lifecycle: "late_prime",
          currentContributionScore: 0.84,
          futureContributionScore: 0.3
        }),
        player({
          playerId: 20,
          role: "developing",
          lifecycle: "development",
          currentContributionScore: 0.55,
          futureContributionScore: 0.85,
          projection: projection(20, 39)
        }),
        player({
          playerId: 30,
          role: "core",
          currentContributionScore: 0.82,
          futureContributionScore: 0.82
        }),
        player({
          playerId: 40,
          role: "core",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        })
      ],
      [{ ...forwardRequirement, minimum: 4, ideal: 4, maximum: 5 }]
    );

    expect(recommendationFor(result)).toMatchObject({
      type: "accelerate_development",
      priority: "high",
      targetPlayerId: 20
    });
    expect(recommendationFor(result).reasons).toContainEqual({
      type: "successor_not_ready_in_time",
      playerId: 20
    });
  });

  it("prepares a long-term successor when the pipeline exists", () => {
    const result = recommend(
      [
        player({
          playerId: 10,
          role: "core",
          lifecycle: "late_prime",
          currentContributionScore: 0.85,
          futureContributionScore: 0.3
        }),
        player({
          playerId: 11,
          role: "core",
          lifecycle: "late_prime",
          currentContributionScore: 0.84,
          futureContributionScore: 0.3
        }),
        player({
          playerId: 20,
          role: "developing",
          lifecycle: "development",
          currentContributionScore: 0.4,
          futureContributionScore: 0.8,
          projection: projection(20, 50)
        }),
        player({
          playerId: 30,
          role: "core",
          currentContributionScore: 0.82,
          futureContributionScore: 0.82
        })
      ],
      [{ ...forwardRequirement, minimum: 2, ideal: 2, maximum: 4 }]
    );

    expect(recommendationFor(result)).toMatchObject({
      type: "prepare_successor",
      horizon: "medium_term",
      playerIds: [20]
    });
  });

  it("uses external help when no internal successor can cover the future gap", () => {
    const result = recommend(
      [
        player({
          playerId: 10,
          role: "core",
          lifecycle: "late_prime",
          currentContributionScore: 0.85,
          futureContributionScore: 0.3
        }),
        player({
          playerId: 11,
          role: "core",
          lifecycle: "late_prime",
          currentContributionScore: 0.84,
          futureContributionScore: 0.3
        }),
        player({
          playerId: 30,
          role: "core",
          currentContributionScore: 0.82,
          futureContributionScore: 0.82
        }),
        player({
          playerId: 40,
          role: "core",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        })
      ],
      [{ ...forwardRequirement, minimum: 4, ideal: 4, maximum: 5 }]
    );

    expect(recommendationFor(result)).toMatchObject({ type: "find_external", priority: "high" });
    expect(recommendationFor(result).reasons).toContainEqual({ type: "no_internal_candidate" });
  });

  it("reduces an overstocked profile without creating a sell action", () => {
    const result = recommend(
      Array.from({ length: 5 }, (_, index) =>
        player({
          playerId: index + 1,
          role: index === 0 ? "rotation" : "core",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        })
      )
    );

    expect(recommendationFor(result)).toMatchObject({ type: "reduce_depth", playerIds: [1] });
    expect(
      result.recommendations.every((recommendation) => !recommendation.type.includes("sell"))
    ).toBe(true);
  });

  it("detects prospect congestion", () => {
    const result = recommend(
      Array.from({ length: 5 }, (_, index) =>
        player({
          playerId: index + 1,
          role: "prospect",
          lifecycle: "prospect",
          currentContributionScore: 0.35,
          futureContributionScore: 0.6
        })
      )
    );

    expect(recommendationFor(result)).toMatchObject({ type: "reduce_depth" });
    expect(recommendationFor(result).reasons).toContainEqual({ type: "development_congestion" });
  });

  it("suggests a valid reprofile only from explicit alternate profile evidence", () => {
    const result = recommend(
      [
        player({
          playerId: 1,
          role: "core",
          currentContributionScore: 0.95,
          futureContributionScore: 0.8,
          profileContributions: { forward: 0.79, midfielder: 0.76 },
          compatibleProfiles: ["midfielder"]
        }),
        player({
          playerId: 2,
          role: "rotation",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        }),
        player({
          playerId: 3,
          role: "rotation",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        }),
        player({
          playerId: 4,
          role: "rotation",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        })
      ],
      [{ profile: "forward", minimum: 2, ideal: 2, maximum: 3 }, midfielderRequirement]
    );

    expect(recommendationFor(result, "midfielder")).toMatchObject({
      type: "reprofile_player",
      targetPlayerId: 1
    });
    expect(recommendationFor(result, "midfielder").reasons).toContainEqual({
      type: "compatible_reprofile_candidate",
      playerId: 1,
      targetProfile: "midfielder"
    });
  });

  it("does not reprofile on weak alternate evidence", () => {
    const result = recommend(
      [
        player({
          playerId: 1,
          role: "core",
          currentContributionScore: 0.95,
          futureContributionScore: 0.8,
          profileContributions: { forward: 0.79, midfielder: 0.6 },
          compatibleProfiles: ["midfielder"]
        }),
        player({
          playerId: 2,
          role: "rotation",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        }),
        player({
          playerId: 3,
          role: "rotation",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        }),
        player({
          playerId: 4,
          role: "rotation",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        })
      ],
      [{ profile: "forward", minimum: 2, ideal: 2, maximum: 3 }, midfielderRequirement]
    );

    expect(recommendationFor(result, "midfielder").type).not.toBe("reprofile_player");
  });

  it("turns a dependency risk into a monitor recommendation", () => {
    const result = recommend(
      [
        player({
          playerId: 1,
          role: "core",
          currentContributionScore: 0.99,
          futureContributionScore: 0.95
        }),
        player({
          playerId: 2,
          role: "core",
          currentContributionScore: 0.72,
          futureContributionScore: 0.72
        }),
        player({
          playerId: 3,
          role: "depth",
          currentContributionScore: 0.4,
          futureContributionScore: 0.4
        })
      ],
      [{ ...forwardRequirement, minimum: 2, ideal: 2, maximum: 3 }]
    );

    expect(recommendationFor(result)).toMatchObject({ type: "monitor", priority: "medium" });
    expect(recommendationFor(result).reasons).toContainEqual({
      type: "single_player_dependency",
      playerId: 1
    });
  });

  it("deduplicates repeated reasons", () => {
    const result = recommend([
      player({ currentContributionScore: 0.3, futureContributionScore: 0.3 })
    ]);
    const reasons = recommendationFor(result).reasons.map((reason) => JSON.stringify(reason));

    expect(new Set(reasons).size).toBe(reasons.length);
  });

  it("ranks internal candidates deterministically", () => {
    const result = recommend([
      player({ playerId: 1, currentContributionScore: 0.2, futureContributionScore: 0.2 }),
      player({
        playerId: 2,
        role: "developing",
        lifecycle: "development",
        currentContributionScore: 0.55,
        futureContributionScore: 0.8
      }),
      player({
        playerId: 3,
        role: "developing",
        lifecycle: "development",
        currentContributionScore: 0.6,
        futureContributionScore: 0.7
      })
    ]);

    expect(recommendationFor(result).type).toBe("develop_internal");
    expect(recommendationFor(result).targetPlayerId).toBe(2);
  });

  it("prioritizes a transition player as a depth-reduction candidate", () => {
    const result = recommend([
      player({
        playerId: 1,
        role: "transition",
        lifecycle: "late_prime",
        currentContributionScore: 0.85,
        futureContributionScore: 0.2
      }),
      ...Array.from({ length: 5 }, (_, index) =>
        player({
          playerId: index + 2,
          role: "core",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        })
      )
    ]);

    expect(recommendationFor(result).type).toBe("reduce_depth");
    expect(recommendationFor(result).playerIds).toContain(1);
  });

  it("does not arbitrarily select the strongest core as a reduction candidate", () => {
    const result = recommend([
      player({
        playerId: 1,
        role: "core",
        currentContributionScore: 0.98,
        futureContributionScore: 0.98
      }),
      ...Array.from({ length: 4 }, (_, index) =>
        player({
          playerId: index + 2,
          role: "rotation",
          currentContributionScore: 0.75,
          futureContributionScore: 0.75
        })
      )
    ]);

    expect(recommendationFor(result).playerIds).not.toContain(1);
  });

  it("uses horizon-aware priorities", () => {
    const current = recommendationFor(
      recommend([player({ currentContributionScore: 0.2, futureContributionScore: 0.2 })])
    );
    const medium = recommendationFor(
      recommend(
        [
          player({
            playerId: 1,
            role: "developing",
            lifecycle: "development",
            currentContributionScore: 0.85,
            futureContributionScore: 0.3
          }),
          player({
            playerId: 2,
            role: "core",
            currentContributionScore: 0.82,
            futureContributionScore: 0.82
          }),
          player({
            playerId: 3,
            role: "core",
            currentContributionScore: 0.8,
            futureContributionScore: 0.8
          })
        ],
        [{ ...forwardRequirement, minimum: 3, ideal: 3, maximum: 4 }]
      )
    );

    expect(current.priority).toBe("critical");
    expect(medium.priority).toBe("medium");
  });

  it("keeps confidence independent from priority", () => {
    const result = recommend([
      player({ confidence: "low", currentContributionScore: 0.2, futureContributionScore: 0.2 })
    ]);

    expect(recommendationFor(result)).toMatchObject({ priority: "critical", confidence: "low" });
  });

  it("detects multiple-profile demand conflicts and downgrades them to monitor", () => {
    const shared = player({
      playerId: 1,
      role: "developing",
      lifecycle: "development",
      currentContributionScore: 0.55,
      futureContributionScore: 0.85,
      compatibleProfiles: ["midfielder"],
      profileContributions: { midfielder: 0.8 }
    });
    const result = recommend(
      [
        shared,
        player({ playerId: 2, currentContributionScore: 0.2, futureContributionScore: 0.2 }),
        player({
          playerId: 3,
          profile: "midfielder",
          currentContributionScore: 0.2,
          futureContributionScore: 0.2
        })
      ],
      [forwardRequirement, midfielderRequirement]
    );

    expect(result.conflicts).toEqual([
      expect.objectContaining({ playerId: 1, type: "multiple_profile_demand" })
    ]);
    expect(
      result.recommendations
        .filter((recommendation) => recommendation.playerIds.includes(1))
        .every((recommendation) => recommendation.type === "monitor")
    ).toBe(true);
  });

  it("sorts recommendations globally by priority", () => {
    const result = recommend(
      [
        player({ playerId: 1, currentContributionScore: 0.2, futureContributionScore: 0.2 }),
        player({
          playerId: 2,
          profile: "midfielder",
          currentContributionScore: 0.2,
          futureContributionScore: 0.2
        })
      ],
      [forwardRequirement, midfielderRequirement]
    );

    expect(result.recommendations[0]?.priority).toBe("critical");
  });

  it("builds a correct global summary", () => {
    const result = recommend([
      player({ currentContributionScore: 0.2, futureContributionScore: 0.2 })
    ]);

    expect(result.summary).toMatchObject({
      critical: 1,
      profilesNeedingExternalHelp: 1,
      profilesWithInternalSolutions: 0
    });
  });

  it("is deterministic for the same squad state", () => {
    const players = [
      player({ playerId: 2, currentContributionScore: 0.2, futureContributionScore: 0.2 }),
      player({ playerId: 1, currentContributionScore: 0.2, futureContributionScore: 0.2 })
    ];

    expect(recommend(players)).toEqual(recommend(players));
  });

  it("keeps a borderline previous reduction recommendation stable", () => {
    const previous = recommend(
      Array.from({ length: 5 }, (_, index) =>
        player({ playerId: index + 1, currentContributionScore: 0.8, futureContributionScore: 0.8 })
      )
    );
    const current = recommend(
      [
        player({ playerId: 1, currentContributionScore: 0.8, futureContributionScore: 0.8 }),
        player({ playerId: 2, currentContributionScore: 0.8, futureContributionScore: 0.8 })
      ],
      [forwardRequirement],
      previous
    );

    expect(recommendationFor(previous).type).toBe("reduce_depth");
    expect(recommendationFor(current).type).toBe("reduce_depth");
  });

  it("does not expose market transactions or market value", () => {
    const result = recommend([
      player({ currentContributionScore: 0.2, futureContributionScore: 0.2 })
    ]);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("buy_player");
    expect(serialized).not.toContain("sell_player");
    expect(serialized).not.toContain("marketValue");
  });

  it("does not duplicate a player as a full multi-profile option", () => {
    const players = [
      player({
        playerId: 1,
        role: "core",
        currentContributionScore: 0.85,
        futureContributionScore: 0.85,
        compatibleProfiles: ["midfielder"],
        profileContributions: { midfielder: 0.76 }
      }),
      player({
        playerId: 2,
        role: "core",
        currentContributionScore: 0.85,
        futureContributionScore: 0.85
      })
    ];
    const result = recommend(players, [forwardRequirement, midfielderRequirement]);
    const depthAnalysis = analyze(players, [forwardRequirement, midfielderRequirement]);

    expect(
      depthAnalysis.profiles.find((profile) => profile.profile === "midfielder")?.current
        .availablePlayers
    ).toBe(0.65);
    expect(result.recommendations).toBeDefined();
  });
});

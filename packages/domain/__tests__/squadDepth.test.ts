import { describe, expect, it } from "vitest";

import {
  analyzeSquadDepth,
  SQUAD_PROFILE_REQUIREMENTS,
  type PlayerDevelopmentProjection,
  type SquadDepthPlayer,
  type SquadProfileRequirement
} from "@atlas/domain";

const forwardRequirement: SquadProfileRequirement = {
  profile: "forward",
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
    developmentPotentialScore: null,
    currentContributionPercentile: null,
    confidence: overrides.confidence ?? "high",
    reasons: [],
    ...overrides
  };
}

function projection(
  playerId: number,
  estimatedWeeks: number,
  estimatedGameWeek: number
): PlayerDevelopmentProjection {
  return {
    playerId,
    profile: "forward",
    generatedAtGameWeek: 1200,
    generatedAtDate: new Date("2026-08-20T00:00:00.000Z"),
    steps: [],
    milestones: [],
    completion: {
      estimatedWeeks,
      estimatedGameWeek,
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

function analyze(players: readonly SquadDepthPlayer[]) {
  return analyzeSquadDepth(players, {
    requirements: [forwardRequirement],
    currentGameWeek: 1200
  }).profiles[0]!;
}

describe("squad depth analysis", () => {
  it("does not include unsupported wing profiles in the default squad requirements", () => {
    const profiles = SQUAD_PROFILE_REQUIREMENTS.map((requirement) => requirement.profile);

    expect(profiles).not.toContain("wing_defender");
    expect(profiles).not.toContain("winger");
  });

  it("classifies a profile with healthy current and future depth as balanced", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        role: "core",
        currentContributionScore: 0.85,
        futureContributionScore: 0.85
      }),
      player({
        playerId: 2,
        role: "core",
        currentContributionScore: 0.8,
        futureContributionScore: 0.8
      }),
      player({
        playerId: 3,
        role: "rotation",
        currentContributionScore: 0.76,
        futureContributionScore: 0.76
      })
    ]);

    expect(assessment.status).toBe("balanced");
    expect(assessment.current.strongOptions).toBe(3);
    expect(assessment.nextSeason.strongOptions).toBe(3);
    expect(assessment.reasons).toContainEqual({ type: "healthy_depth" });
  });

  it("detects a profile below the minimum", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        role: "core",
        currentContributionScore: 0.85,
        futureContributionScore: 0.85
      })
    ]);

    expect(assessment.status).toBe("thin");
    expect(assessment.reasons).toContainEqual({
      type: "below_minimum_depth",
      current: 1,
      minimum: 2
    });
  });

  it("detects an overstocked profile", () => {
    const assessment = analyze(
      Array.from({ length: 5 }, (_, index) =>
        player({
          playerId: index + 1,
          role: "core",
          currentContributionScore: 0.8,
          futureContributionScore: 0.8
        })
      )
    );

    expect(assessment.status).toBe("overstocked");
    expect(assessment.reasons).toContainEqual({ type: "overstocked_profile" });
  });

  it("does not treat many weak players as competitive depth", () => {
    const assessment = analyze(
      Array.from({ length: 4 }, (_, index) =>
        player({
          playerId: index + 1,
          role: "depth",
          currentContributionScore: 0.3,
          futureContributionScore: 0.3
        })
      )
    );

    expect(assessment.status).not.toBe("balanced");
    expect(assessment.current.strongOptions).toBe(0);
  });

  it("detects dependency on a single dominant player", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        role: "core",
        currentContributionScore: 0.95,
        futureContributionScore: 0.9
      }),
      player({
        playerId: 2,
        role: "rotation",
        currentContributionScore: 0.5,
        futureContributionScore: 0.55
      }),
      player({
        playerId: 3,
        role: "depth",
        currentContributionScore: 0.4,
        futureContributionScore: 0.45
      })
    ]);

    expect(assessment.dependencyRisk).toMatchObject({ dominantPlayerId: 1 });
    expect(assessment.reasons).toContainEqual({ type: "single_player_dependency", playerId: 1 });
  });

  it("detects a transition player without a successor", () => {
    const assessment = analyze([
      player({
        playerId: 10,
        role: "transition",
        lifecycle: "late_prime",
        currentContributionScore: 0.85,
        futureContributionScore: 0.3
      })
    ]);

    expect(assessment.succession.successionRequired).toBe(true);
    expect(assessment.succession.coverageStatus).toBe("missing");
    expect(assessment.succession.outgoingPlayers).toEqual([10]);
    expect(assessment.reasons).toContainEqual({ type: "missing_successor", playerId: 10 });
  });

  it("recognizes a ready successor", () => {
    const assessment = analyze([
      player({
        playerId: 10,
        role: "transition",
        lifecycle: "late_prime",
        currentContributionScore: 0.85,
        futureContributionScore: 0.3
      }),
      player({
        playerId: 20,
        role: "core",
        currentContributionScore: 0.82,
        futureContributionScore: 0.85
      })
    ]);

    expect(assessment.succession.coverageStatus).toBe("covered");
    expect(assessment.succession.successorCandidates[0]).toMatchObject({
      playerId: 20,
      readiness: "ready",
      predecessorPlayerId: 10
    });
  });

  it("recognizes a developing successor that arrives within the horizon", () => {
    const assessment = analyze([
      player({
        playerId: 10,
        role: "transition",
        lifecycle: "late_prime",
        currentContributionScore: 0.85,
        futureContributionScore: 0.3
      }),
      player({
        playerId: 20,
        role: "developing",
        lifecycle: "development",
        currentContributionScore: 0.55,
        futureContributionScore: 0.85,
        projection: projection(20, 10, 1210)
      })
    ]);

    expect(assessment.succession.successorCandidates[0]).toMatchObject({
      playerId: 20,
      readiness: "developing",
      estimatedReadyGameWeek: 1210
    });
    expect(assessment.succession.coverageStatus).toBe("covered");
  });

  it("marks a successor that arrives too late as long term and at risk", () => {
    const assessment = analyze([
      player({
        playerId: 10,
        role: "transition",
        lifecycle: "late_prime",
        currentContributionScore: 0.85,
        futureContributionScore: 0.3
      }),
      player({
        playerId: 20,
        role: "developing",
        lifecycle: "development",
        currentContributionScore: 0.55,
        futureContributionScore: 0.85,
        projection: projection(20, 60, 1260)
      })
    ]);

    expect(assessment.succession.successorCandidates[0]?.readiness).toBe("long_term");
    expect(assessment.succession.coverageStatus).toBe("at_risk");
  });

  it("detects concentration in late lifecycle stages", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        lifecycle: "late_prime",
        role: "rotation",
        currentContributionScore: 0.8,
        futureContributionScore: 0.8
      }),
      player({
        playerId: 2,
        lifecycle: "late_prime",
        role: "rotation",
        currentContributionScore: 0.78,
        futureContributionScore: 0.78
      }),
      player({
        playerId: 3,
        lifecycle: "prime",
        role: "rotation",
        currentContributionScore: 0.75,
        futureContributionScore: 0.75
      })
    ]);

    expect(assessment.reasons).toContainEqual({ type: "late_lifecycle_concentration" });
  });

  it("keeps a healthy prospect pipeline visible", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        role: "core",
        currentContributionScore: 0.85,
        futureContributionScore: 0.85
      }),
      player({
        playerId: 2,
        role: "prospect",
        lifecycle: "prospect",
        currentContributionScore: 0.3,
        futureContributionScore: 0.8
      }),
      player({
        playerId: 3,
        role: "prospect",
        lifecycle: "prospect",
        currentContributionScore: 0.3,
        futureContributionScore: 0.75
      })
    ]);

    expect(assessment.mediumTerm.prospects).toBe(2);
    expect(assessment.succession.coverageStatus).toBe("covered");
  });

  it("detects prospect congestion and orphan prospects", () => {
    const assessment = analyze(
      Array.from({ length: 5 }, (_, index) =>
        player({
          playerId: index + 1,
          role: "prospect",
          lifecycle: "prospect",
          currentContributionScore: 0.2,
          futureContributionScore: 0.7 - index * 0.03
        })
      )
    );

    expect(assessment.reasons.some((reason) => reason.type === "development_congestion")).toBe(
      true
    );
    expect(assessment.reasons.some((reason) => reason.type === "orphan_prospect")).toBe(true);
  });

  it("detects a missing prospect pipeline when succession is required", () => {
    const assessment = analyze([
      player({
        playerId: 10,
        role: "transition",
        lifecycle: "late_prime",
        currentContributionScore: 0.85,
        futureContributionScore: 0.3
      })
    ]);

    expect(assessment.reasons).toContainEqual({ type: "prospect_pipeline_missing" });
  });

  it("separates current good depth from future critical depth", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        role: "core",
        lifecycle: "late_prime",
        currentContributionScore: 0.85,
        futureContributionScore: 0.3
      }),
      player({
        playerId: 2,
        role: "core",
        lifecycle: "late_prime",
        currentContributionScore: 0.82,
        futureContributionScore: 0.3
      })
    ]);

    expect(assessment.current.strongOptions).toBe(2);
    expect(assessment.mediumTerm.strongOptions).toBe(0);
    expect(assessment.reasons).toContainEqual({
      type: "future_depth_below_minimum",
      horizon: "medium_term"
    });
  });

  it("keeps a strong future pipeline when current depth is critical", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        role: "prospect",
        lifecycle: "prospect",
        currentContributionScore: 0.3,
        futureContributionScore: 0.85,
        projection: projection(1, 10, 1210)
      }),
      player({
        playerId: 2,
        role: "prospect",
        lifecycle: "prospect",
        currentContributionScore: 0.3,
        futureContributionScore: 0.8,
        projection: projection(2, 10, 1210)
      })
    ]);

    expect(assessment.current.strongOptions).toBe(0);
    expect(assessment.mediumTerm.strongOptions).toBe(2);
    expect(assessment.status).toBe("thin");
  });

  it("projects next season and medium term using projection completion", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        role: "developing",
        lifecycle: "development",
        currentContributionScore: 0.55,
        futureContributionScore: 0.9,
        projection: projection(1, 10, 1210)
      })
    ]);

    expect(assessment.nextSeason.strongOptions).toBe(1);
    expect(assessment.mediumTerm.strongOptions).toBe(1);
  });

  it("reduces confidence as the horizon gets longer", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        role: "core",
        currentContributionScore: 0.85,
        futureContributionScore: 0.85
      })
    ]);

    expect(assessment.confidence).toBe("low");
  });

  it("keeps goalkeeper depth separate from field profiles", () => {
    const assessment = analyzeSquadDepth(
      [
        player({
          playerId: 1,
          profile: "goalkeeper",
          role: "core",
          currentContributionScore: 0.9,
          futureContributionScore: 0.9
        })
      ],
      { requirements: [{ profile: "goalkeeper", minimum: 1, ideal: 1, maximum: 2 }] }
    ).profiles[0]!;

    expect(assessment.profile).toBe("goalkeeper");
    expect(assessment.current.playerIds).toEqual([1]);
  });

  it("uses a fallback profile when the development profile is absent", () => {
    const assessment = analyzeSquadDepth(
      [
        player({
          playerId: 1,
          profile: null,
          fallbackProfile: "forward",
          role: "core",
          currentContributionScore: 0.85,
          futureContributionScore: 0.85
        })
      ],
      { requirements: [forwardRequirement] }
    ).profiles[0]!;

    expect(assessment.current.playerIds).toEqual([1]);
  });

  it("does not duplicate secondary multi-profile coverage as a full player", () => {
    const multiProfilePlayer = player({
      playerId: 1,
      profile: "forward",
      compatibleProfiles: ["winger"],
      profileContributions: { winger: 0.7 },
      currentContributionScore: 0.8,
      futureContributionScore: 0.8
    });
    const result = analyzeSquadDepth([multiProfilePlayer], {
      requirements: [
        { profile: "forward", minimum: 1, ideal: 1 },
        { profile: "winger", minimum: 1, ideal: 1 }
      ]
    });

    expect(
      result.profiles.find((profile) => profile.profile === "forward")?.current.availablePlayers
    ).toBe(1);
    expect(
      result.profiles.find((profile) => profile.profile === "winger")?.current.availablePlayers
    ).toBe(0.65);
  });

  it("bases depth status on quality and succession, not count alone", () => {
    const assessment = analyze([
      player({
        playerId: 1,
        role: "core",
        currentContributionScore: 0.85,
        futureContributionScore: 0.3,
        lifecycle: "late_prime"
      }),
      player({
        playerId: 2,
        role: "depth",
        currentContributionScore: 0.3,
        futureContributionScore: 0.3
      }),
      player({
        playerId: 3,
        role: "depth",
        currentContributionScore: 0.3,
        futureContributionScore: 0.3
      }),
      player({
        playerId: 4,
        role: "depth",
        currentContributionScore: 0.3,
        futureContributionScore: 0.3
      })
    ]);

    expect(assessment.status).not.toBe("deep");
    expect(assessment.succession.coverageStatus).toBe("missing");
  });

  it("returns a deterministic global summary and ordering", () => {
    const players = [
      player({
        playerId: 2,
        profile: "goalkeeper",
        role: "core",
        currentContributionScore: 0.9,
        futureContributionScore: 0.9
      }),
      player({
        playerId: 1,
        profile: "forward",
        role: "core",
        currentContributionScore: 0.9,
        futureContributionScore: 0.9
      })
    ];
    const first = analyzeSquadDepth(players, {
      requirements: [
        { profile: "forward", minimum: 1, ideal: 1 },
        { profile: "goalkeeper", minimum: 1, ideal: 1 }
      ]
    });
    const second = analyzeSquadDepth([...players].reverse(), {
      requirements: [
        { profile: "goalkeeper", minimum: 1, ideal: 1 },
        { profile: "forward", minimum: 1, ideal: 1 }
      ]
    });

    expect(first).toEqual(second);
    expect(first.summary.balancedProfiles).toBe(2);
  });
});

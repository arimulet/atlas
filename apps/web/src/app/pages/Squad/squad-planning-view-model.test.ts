import { describe, expect, it } from "vitest";

import type {
  DevelopmentProfile,
  ProfileDepthAssessment,
  SquadDepthPlayer,
  SquadPlanningRecommendation,
  SquadRole
} from "@atlas/domain";
import type { SquadPlanningBundle } from "@atlas/web/app/types";
import type { SquadPlayerRow } from "../../view-models/squad-view-model";
import {
  createSquadPlanningViewModel,
  filterSquadRows,
  mapPlanningReason,
  profileLabel,
  roleLabel,
  type SquadPlanningFilters
} from "./squad-planning-view-model";
import { describeManualRoleConflict, planningConfidenceWarning } from "./SquadPlanningSections";

describe("squad planning presentation", () => {
  it("maps role and profile summaries without adding domain rules", () => {
    const planning = createBundle();

    const viewModel = createSquadPlanningViewModel(planning, createRows());

    expect(viewModel.summary.roleCounts.core).toBe(1);
    expect(viewModel.summary.roleCounts.developing).toBe(1);
    expect(viewModel.summary.profileCounts.balanced).toBe(1);
    expect(viewModel.summary.profileCounts.critical).toBe(1);
    expect(viewModel.summary.successionRisks).toBe(1);
    expect(profileLabel("goalkeeper")).toBe("Goalkeeper");
    expect(profileLabel("defender")).toBe("Defender");
    expect(profileLabel("midfielder")).toBe("Midfielder");
    expect(roleLabel("core")).toBe("Core");
  });

  it("shows priority actions, excludes maintain, and keeps global ordering", () => {
    const planning = createBundle([
      recommendation("maintain", "low", "goalkeeper"),
      recommendation("find_external", "critical", "defender"),
      recommendation("develop_internal", "high", "goalkeeper")
    ]);

    const viewModel = createSquadPlanningViewModel(planning, createRows());

    expect(viewModel.priorityActions.map((action) => action.type)).toEqual([
      "find_external",
      "develop_internal"
    ]);
    expect(viewModel.priorityActions[0]?.title).toBe("External solution needed");
    expect(viewModel.priorityActions[0]?.description).not.toContain("buy");
    expect(viewModel.priorityActions[0]?.description).not.toContain("sell");
    expect(
      viewModel.profiles.find((profile) => profile.profile === "defender")?.recommendations
    ).toEqual([
      expect.objectContaining({
        type: "find_external",
        title: "External solution needed",
        priority: "critical",
        horizonLabel: "Current"
      })
    ]);
  });

  it("keeps current, next season and medium-term snapshots distinct", () => {
    const viewModel = createSquadPlanningViewModel(createBundle(), createRows());
    const profile = viewModel.profiles.find((entry) => entry.profile === "defender");

    expect(profile?.current.availablePlayers).toBe(2);
    expect(profile?.nextSeason.availablePlayers).toBe(1);
    expect(profile?.mediumTerm.availablePlayers).toBe(0);
    expect(profile?.statusLabel).toBe("Critical");
  });

  it("hides unsupported wing profiles from the squad depth view", () => {
    const planning = createBundle();
    planning.depth.profiles.push(createProfile("wing_defender", [], [], [], "critical", "high"));
    planning.depth.profiles.push(createProfile("winger", [], [], [], "critical", "high"));

    const viewModel = createSquadPlanningViewModel(planning, createRows());

    expect(viewModel.profiles.map((profile) => profile.profile)).not.toContain("wing_defender");
    expect(viewModel.profiles.map((profile) => profile.profile)).not.toContain("winger");
  });

  it("exposes succession, dependency, congestion and missing pipeline signals", () => {
    const viewModel = createSquadPlanningViewModel(createBundle(), createRows());
    const profile = viewModel.profiles.find((entry) => entry.profile === "defender");

    expect(profile?.successionStatus).toBe("missing");
    expect(profile?.dependencyRisk?.playerName).toBe("Ana");
    expect(profile?.congestionMessage).toContain("3 players");
    expect(profile?.missingPipeline).toBe(true);
  });

  it("filters by role, development profile and recommendation attention", () => {
    const planning = createBundle([
      recommendation("accelerate_development", "high", "goalkeeper", [2])
    ]);
    const viewModel = createSquadPlanningViewModel(planning, createRows());
    const all: SquadPlanningFilters = { role: "all", profile: "all" };

    expect(
      filterSquadRows(
        createRows(),
        planning,
        { ...all, role: "core" },
        viewModel.attentionPlayerIds
      )
    ).toHaveLength(1);
    expect(
      filterSquadRows(
        createRows(),
        planning,
        { ...all, profile: "goalkeeper" },
        viewModel.attentionPlayerIds
      )
    ).toHaveLength(2);
    expect(
      filterSquadRows(
        createRows(),
        planning,
        { ...all, role: "attention" },
        viewModel.attentionPlayerIds
      )
    ).toEqual([
      expect.objectContaining({ playerId: "1" }),
      expect.objectContaining({ playerId: "2" }),
      expect.objectContaining({ playerId: "3" })
    ]);
  });

  it("maps recommendation reasons to human-readable UI copy", () => {
    const names = new Map([["2", "Bruno"]]);

    expect(
      mapPlanningReason({ type: "internal_candidate_available", playerId: 2 }, names)
    ).toContain("Bruno");
    expect(
      mapPlanningReason({ type: "future_depth_below_minimum", horizon: "next_season" }, names)
    ).toContain("Next season");
  });

  it("shows manual role conflicts without treating them as errors", () => {
    expect(describeManualRoleConflict("developing", "core")).toBe("ATLAS suggests Developing");
    expect(describeManualRoleConflict("core", "core")).toBeNull();
  });

  it("warns when future projection confidence is low", () => {
    const viewModel = createSquadPlanningViewModel(createBundle([], "low"), createRows());

    expect(planningConfidenceWarning(viewModel)).toContain("low confidence");
  });

  it("is deterministic for the same planning state", () => {
    const first = createSquadPlanningViewModel(createBundle(), createRows());
    const second = createSquadPlanningViewModel(createBundle(), createRows());

    expect(first.priorityActions).toEqual(second.priorityActions);
    expect(first.profiles).toEqual(second.profiles);
  });
});

function createBundle(
  recommendations: readonly SquadPlanningRecommendation[] = [],
  confidence: "low" | "high" = "high"
): SquadPlanningBundle {
  const players = [
    createPlayer(1, "goalkeeper", "core", "prime", confidence),
    createPlayer(2, "goalkeeper", "developing", "development", confidence),
    createPlayer(3, "defender", "transition", "late_prime", confidence)
  ];
  const profiles = [
    createProfile("goalkeeper", [1, 2], [2], [], "balanced", confidence),
    createProfile("defender", [3, 1], [1], [], "critical", confidence)
  ];

  return {
    assessment: {
      players,
      summary: {
        core: 1,
        developing: 1,
        prospect: 0,
        rotation: 0,
        depth: 0,
        transition: 1
      },
      manualAssignments: [],
      currentGameWeek: 10,
      depthPlayers: players
    },
    depth: {
      profiles,
      summary: {
        criticalProfiles: 1,
        thinProfiles: 0,
        balancedProfiles: 1,
        deepProfiles: 0,
        overstockedProfiles: 0,
        missingSuccessions: 1,
        dependencyRisks: 1
      }
    },
    recommendations: {
      recommendations: [...recommendations],
      conflicts: [],
      summary: {
        critical: recommendations.filter((entry) => entry.priority === "critical").length,
        high: recommendations.filter((entry) => entry.priority === "high").length,
        medium: 0,
        low: recommendations.filter((entry) => entry.priority === "low").length,
        profilesNeedingExternalHelp: recommendations.filter(
          (entry) => entry.type === "find_external"
        ).length,
        profilesWithInternalSolutions: recommendations.filter(
          (entry) => entry.type === "develop_internal"
        ).length,
        profilesOverstocked: 0
      }
    }
  };
}

function createPlayer(
  playerId: number,
  profile: DevelopmentProfile,
  role: SquadRole,
  lifecycle: SquadDepthPlayer["lifecycle"],
  confidence: "low" | "high"
): SquadDepthPlayer {
  return {
    playerId,
    role,
    automaticRole: role,
    source: "automatic",
    manualRole: null,
    lifecycle,
    profile,
    currentContributionScore: role === "core" ? 0.82 : 0.48,
    futureContributionScore: role === "transition" ? 0.3 : 0.78,
    developmentPotentialScore: role === "developing" ? 0.82 : 0.25,
    currentContributionPercentile: 0.6,
    confidence,
    reasons: [],
    age: 25
  };
}

function createProfile(
  profile: DevelopmentProfile,
  currentIds: number[],
  nextIds: number[],
  mediumIds: number[],
  status: ProfileDepthAssessment["status"],
  confidence: "low" | "high"
): ProfileDepthAssessment {
  return {
    profile,
    requirement: { profile, minimum: 2, ideal: 3, maximum: 4 },
    current: createSnapshot(currentIds),
    nextSeason: createSnapshot(nextIds),
    mediumTerm: createSnapshot(mediumIds),
    succession: {
      successionRequired: profile === "defender",
      outgoingPlayers: profile === "defender" ? [3] : [],
      successorCandidates: [],
      coverageStatus: profile === "defender" ? "missing" : "covered"
    },
    status,
    confidence,
    dependencyRisk: profile === "defender" ? { dominantPlayerId: 1, contributionGap: 0.4 } : null,
    reasons:
      profile === "defender"
        ? [
            { type: "development_congestion", candidates: 3 },
            { type: "prospect_pipeline_missing" },
            { type: "single_player_dependency", playerId: 1 },
            { type: "missing_successor", playerId: 3 }
          ]
        : [{ type: "healthy_depth" }]
  };
}

function createSnapshot(playerIds: number[]) {
  return {
    availablePlayers: playerIds.length,
    strongOptions: playerIds.length > 0 ? 1 : 0,
    developingOptions: playerIds.length > 1 ? 1 : 0,
    prospects: 0,
    playerIds,
    depthScore: playerIds.length > 0 ? 0.7 : 0.1
  };
}

function recommendation(
  type: SquadPlanningRecommendation["type"],
  priority: SquadPlanningRecommendation["priority"],
  profile: DevelopmentProfile,
  playerIds: number[] = []
): SquadPlanningRecommendation {
  return {
    id: `${type}-${profile}`,
    type,
    profile,
    priority,
    horizon: priority === "critical" ? "current" : "next_season",
    playerIds,
    confidence: "high",
    reasons:
      type === "find_external"
        ? [{ type: "no_internal_candidate" }]
        : type === "develop_internal"
          ? [{ type: "internal_candidate_available", playerId: playerIds[0] ?? 2 }]
          : [{ type: "future_depth_below_minimum", horizon: "next_season" }]
  };
}

function createRows(): SquadPlayerRow[] {
  return [1, 2, 3].map((playerId, index) => ({
    playerId: String(playerId),
    playerName: ["Ana", "Bruno", "Carlos"][index] ?? `Player ${playerId}`,
    age: 25,
    gameValue: null,
    form: null,
    skills: {
      stamina: null,
      pace: null,
      technique: null,
      passing: null,
      keeper: null,
      defender: null,
      playmaker: null,
      striker: null
    },
    training: {
      position: "GK",
      trainedSkill: null,
      trainingType: null,
      trainingKind: null,
      intensity: null,
      progress: null,
      status: null
    },
    development: { talent: null, nextSkillUp: null, etaWeeks: null }
  }));
}

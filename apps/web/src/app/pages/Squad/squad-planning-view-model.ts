import type {
  DevelopmentProfile,
  PlayerLifecycleStage,
  ProfileDepthAssessment,
  ProfileDepthSnapshot,
  SquadDepthPlayer,
  SquadDepthReason,
  SquadPlanningHorizon,
  SquadPlanningRecommendation,
  SquadPlanningReason,
  SquadPlanningRecommendationPriority,
  SquadRole,
  SuccessionCandidate,
  SuccessionCoverageStatus
} from "@atlas/domain";
import type { SquadPlanningBundle } from "@atlas/web/app/types";
import type { SquadPlayerRow } from "../../view-models/squad-view-model";

export type SquadRoleFilter = SquadRole | "all" | "attention";

export interface SquadPlanningFilters {
  role: SquadRoleFilter;
  profile: DevelopmentProfile | "all";
}

export interface SquadPlanningSummaryViewModel {
  playerCount: number;
  roleCounts: Record<SquadRole, number>;
  profileCounts: {
    critical: number;
    thin: number;
    balanced: number;
    deep: number;
    overstocked: number;
  };
  successionRisks: number;
  externalNeeds: number;
  hasLowConfidenceProjection: boolean;
}

export interface SquadPlanningCandidateViewModel {
  playerId: string;
  playerName: string;
  suitabilityScore: number | null;
  role: SquadRole;
  lifecycle: PlayerLifecycleStage;
  currentContribution: number | null;
  futureContribution: number | null;
  profile: DevelopmentProfile | null;
  confidence: string;
}

export interface SquadPriorityActionViewModel {
  id: string;
  type: SquadPlanningRecommendation["type"];
  profile: DevelopmentProfile;
  profileLabel: string;
  title: string;
  description: string;
  priority: SquadPlanningRecommendationPriority;
  horizon: SquadPlanningHorizon;
  horizonLabel: string;
  confidence: string;
  playerIds: string[];
  targetPlayerId: string | null;
  candidates: SquadPlanningCandidateViewModel[];
  reasons: string[];
}

export type SquadProfilePlayerGroup = "current" | "developing" | "prospect" | "transition";

export interface SquadProfilePlayerViewModel {
  playerId: string;
  name: string;
  age: number | null;
  role: SquadRole;
  roleLabel: string;
  lifecycle: PlayerLifecycleStage;
  lifecycleLabel: string;
  currentContribution: string;
  futureContribution: string;
  currentContributionScore: number | null;
  futureContributionScore: number | null;
  group: SquadProfilePlayerGroup;
  readiness: string | null;
}

export interface SquadSuccessionCandidateViewModel {
  playerId: string;
  playerName: string;
  readiness: SuccessionCandidate["readiness"];
  readinessLabel: string;
  estimatedReadyGameWeek: number | null;
  confidence: string;
  predecessorPlayerId: string | null;
}

export interface SquadProfileViewModel {
  profile: DevelopmentProfile;
  profileLabel: string;
  requirement: ProfileDepthAssessment["requirement"];
  current: SquadDepthSnapshotViewModel;
  nextSeason: SquadDepthSnapshotViewModel;
  mediumTerm: SquadDepthSnapshotViewModel;
  successionStatus: SuccessionCoverageStatus;
  successionLabel: string;
  outgoingPlayers: SquadProfilePlayerViewModel[];
  successorCandidates: SquadSuccessionCandidateViewModel[];
  players: SquadProfilePlayerViewModel[];
  dependencyRisk: { playerId: string; playerName: string; contributionGap: string } | null;
  congestionMessage: string | null;
  missingPipeline: boolean;
  reasons: string[];
  status: ProfileDepthAssessment["status"];
  statusLabel: string;
  confidence: string;
  recommendations: SquadPriorityActionViewModel[];
}

export interface SquadDepthSnapshotViewModel {
  availablePlayers: number;
  strongOptions: number;
  developingOptions: number;
  prospects: number;
  playerIds: string[];
  depthScore: number | null;
}

export interface SquadPlanningViewModel {
  summary: SquadPlanningSummaryViewModel;
  priorityActions: SquadPriorityActionViewModel[];
  profiles: SquadProfileViewModel[];
  attentionPlayerIds: Set<string>;
  hasLowConfidenceProjection: boolean;
}

export const SQUAD_ROLE_ORDER: readonly SquadRole[] = [
  "core",
  "developing",
  "prospect",
  "rotation",
  "depth",
  "transition"
];

export const SQUAD_PROFILE_ORDER: readonly DevelopmentProfile[] = [
  "goalkeeper",
  "central_defender",
  "wing_defender",
  "central_midfielder",
  "winger",
  "forward"
];

const PRIORITY_ORDER: Record<SquadPlanningRecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

const ROLE_LABELS: Record<SquadRole, string> = {
  core: "Core",
  developing: "Developing",
  prospect: "Prospect",
  rotation: "Rotation",
  depth: "Depth",
  transition: "Transition"
};

const PROFILE_LABELS: Record<DevelopmentProfile, string> = {
  goalkeeper: "Goalkeeper",
  central_defender: "Central Defender",
  wing_defender: "Wing Defender",
  central_midfielder: "Central Midfielder",
  winger: "Winger",
  forward: "Forward"
};

const LIFECYCLE_LABELS: Record<PlayerLifecycleStage, string> = {
  prospect: "Prospect",
  development: "Development",
  prime: "Prime",
  late_prime: "Late prime",
  decline: "Decline"
};

const STATUS_LABELS: Record<ProfileDepthAssessment["status"], string> = {
  critical: "Critical",
  thin: "Thin",
  balanced: "Balanced",
  deep: "Deep",
  overstocked: "Overstocked"
};

const HORIZON_LABELS: Record<SquadPlanningHorizon, string> = {
  current: "Current",
  next_season: "Next season",
  medium_term: "Medium term"
};

const RECOMMENDATION_TITLES: Record<SquadPlanningRecommendation["type"], string> = {
  maintain: "Maintain",
  develop_internal: "Develop internally",
  accelerate_development: "Accelerate development",
  reprofile_player: "Consider profile change",
  find_external: "External solution needed",
  reduce_depth: "Reduce depth",
  prepare_successor: "Prepare successor",
  monitor: "Monitor"
};

const READINESS_LABELS: Record<SuccessionCandidate["readiness"], string> = {
  ready: "Ready",
  developing: "Developing",
  long_term: "Long-term"
};

export function createSquadPlanningViewModel(
  planning: SquadPlanningBundle,
  rows: readonly SquadPlayerRow[]
): SquadPlanningViewModel {
  const playerNames = createPlayerNames(rows);
  const players = planning.assessment.depthPlayers;
  const recommendations = planning.recommendations.recommendations
    .map((recommendation) => mapRecommendation(recommendation, playerNames))
    .sort(comparePriorityActions);
  const profiles = planning.depth.profiles.map((assessment) =>
    mapProfile(assessment, players, playerNames, recommendations)
  );
  const summary = mapSummary(planning, rows.length);
  const attentionPlayerIds = new Set<string>(
    recommendations.flatMap((recommendation) => recommendation.playerIds)
  );

  profiles.forEach((profile) => {
    profile.outgoingPlayers.forEach((player) => attentionPlayerIds.add(player.playerId));
    if (profile.dependencyRisk) {
      attentionPlayerIds.add(profile.dependencyRisk.playerId);
    }
  });

  return {
    summary,
    priorityActions: recommendations.filter((recommendation) => recommendation.type !== "maintain"),
    profiles,
    attentionPlayerIds,
    hasLowConfidenceProjection: summary.hasLowConfidenceProjection
  };
}

export function createSquadPriorityActionsViewModel(
  planning: SquadPlanningBundle
): SquadPriorityActionViewModel[] {
  const playerNames = new Map(
    planning.assessment.depthPlayers.map((player) => [
      String(player.playerId),
      player.playerName || `Player ${player.playerId}`
    ])
  );

  return planning.recommendations.recommendations
    .map((recommendation) => mapRecommendation(recommendation, playerNames))
    .sort(comparePriorityActions)
    .filter((recommendation) => recommendation.type !== "maintain");
}

export function filterSquadRows(
  rows: readonly SquadPlayerRow[],
  planning: SquadPlanningBundle | null,
  filters: SquadPlanningFilters,
  attentionPlayerIds: ReadonlySet<string>
): SquadPlayerRow[] {
  if (planning === null) {
    return [...rows];
  }

  const playersById = new Map(
    (planning?.assessment.depthPlayers ?? []).map((player) => [String(player.playerId), player])
  );

  return rows.filter((row) => {
    const player = playersById.get(row.playerId);

    if (filters.role !== "all") {
      if (filters.role === "attention") {
        if (!attentionPlayerIds.has(row.playerId)) {
          return false;
        }
      } else if (player?.role !== filters.role) {
        return false;
      }
    }

    if (filters.profile !== "all") {
      if (!player || !playerMatchesProfile(player, filters.profile)) {
        return false;
      }
    }

    return true;
  });
}

export function roleLabel(role: SquadRole): string {
  return ROLE_LABELS[role];
}

export function profileLabel(profile: DevelopmentProfile): string {
  return PROFILE_LABELS[profile];
}

export function lifecycleLabel(lifecycle: PlayerLifecycleStage): string {
  return LIFECYCLE_LABELS[lifecycle];
}

export function statusLabel(status: ProfileDepthAssessment["status"]): string {
  return STATUS_LABELS[status];
}

export function horizonLabel(horizon: SquadPlanningHorizon): string {
  return HORIZON_LABELS[horizon];
}

export function recommendationTitle(type: SquadPlanningRecommendation["type"]): string {
  return RECOMMENDATION_TITLES[type];
}

export function confidenceLabel(confidence: string): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

export function formatContributionScore(score: number | null): string {
  return score === null ? "—" : `${Math.round(score * 100)}%`;
}

export function mapDepthReason(
  reason: SquadDepthReason,
  playerNames: ReadonlyMap<string, string>
): string {
  switch (reason.type) {
    case "below_minimum_depth":
      return `Current depth is ${reason.current}; minimum is ${reason.minimum}.`;
    case "healthy_depth":
      return "Current structure is healthy.";
    case "single_player_dependency":
      return `Single-player dependency: ${playerName(reason.playerId, playerNames)} carries most of the current contribution.`;
    case "missing_successor":
      return reason.playerId === undefined
        ? "No internal successor is identified."
        : `No internal successor is identified for ${playerName(reason.playerId, playerNames)}.`;
    case "succession_covered":
      return `Succession is covered by ${playerName(reason.successorPlayerId, playerNames)}.`;
    case "late_lifecycle_concentration":
      return "Several options are concentrated in an advanced lifecycle stage.";
    case "development_congestion":
      return `${reason.candidates} players are competing for limited projected roles.`;
    case "prospect_pipeline_missing":
      return "No developing or prospect player is projected to cover this profile.";
    case "overstocked_profile":
      return "The profile has more players than its strategic capacity.";
    case "future_depth_below_minimum":
      return `${horizonLabel(reason.horizon)} depth is below the required minimum.`;
    case "future_depth_healthy":
      return `${horizonLabel(reason.horizon)} depth is healthy.`;
    case "orphan_prospect":
      return `${playerName(reason.playerId, playerNames)} has no clear future slot in this profile.`;
  }
}

export function mapPlanningReason(
  reason: SquadPlanningReason,
  playerNames: ReadonlyMap<string, string>
): string {
  switch (reason.type) {
    case "current_depth_below_minimum":
      return `Current depth is below the required minimum (${reason.current}/${reason.minimum}).`;
    case "future_depth_below_minimum":
      return `${horizonLabel(reason.horizon)} depth is below the required minimum.`;
    case "missing_successor":
      return "No internal successor is projected to cover the gap.";
    case "successor_not_ready_in_time":
      return `${playerName(reason.playerId, playerNames)} is not projected to be ready in time.`;
    case "internal_candidate_available":
      return `${playerName(reason.playerId, playerNames)} is the strongest internal candidate.`;
    case "no_internal_candidate":
      return "No internal candidate is projected to cover the gap.";
    case "profile_overstocked":
      return `The profile has ${reason.count} players against a maximum of ${reason.maximum}.`;
    case "development_congestion":
      return "The development pipeline is congested.";
    case "single_player_dependency":
      return `Current contribution depends heavily on ${playerName(reason.playerId, playerNames)}.`;
    case "compatible_reprofile_candidate":
      return `${playerName(reason.playerId, playerNames)} has a compatible ${profileLabel(reason.targetProfile)} fit.`;
    case "borderline_succession":
      return "Succession is borderline and needs monitoring.";
    case "low_confidence_projection":
      return "The future projection has limited confidence.";
    case "healthy_profile":
      return "The profile is structurally healthy.";
  }
}

function mapSummary(
  planning: SquadPlanningBundle,
  playerCount: number
): SquadPlanningSummaryViewModel {
  const profileCounts = planning.depth.summary;
  return {
    playerCount,
    roleCounts: planning.assessment.summary,
    profileCounts: {
      critical: profileCounts.criticalProfiles,
      thin: profileCounts.thinProfiles,
      balanced: profileCounts.balancedProfiles,
      deep: profileCounts.deepProfiles,
      overstocked: profileCounts.overstockedProfiles
    },
    successionRisks: profileCounts.missingSuccessions,
    externalNeeds: planning.recommendations.summary.profilesNeedingExternalHelp,
    hasLowConfidenceProjection: planning.depth.profiles.some(
      (profile) => profile.confidence === "low"
    )
  };
}

function mapRecommendation(
  recommendation: SquadPlanningRecommendation,
  playerNames: ReadonlyMap<string, string>
): SquadPriorityActionViewModel {
  const reasons = recommendation.reasons.map((reason) => mapPlanningReason(reason, playerNames));
  const description = recommendationDescription(recommendation, reasons, playerNames);

  return {
    id: recommendation.id,
    type: recommendation.type,
    profile: recommendation.profile,
    profileLabel: profileLabel(recommendation.profile),
    title: recommendationTitle(recommendation.type),
    description,
    priority: recommendation.priority,
    horizon: recommendation.horizon,
    horizonLabel: horizonLabel(recommendation.horizon),
    confidence: confidenceLabel(recommendation.confidence),
    playerIds: recommendation.playerIds.map(String),
    targetPlayerId:
      recommendation.targetPlayerId === undefined ? null : String(recommendation.targetPlayerId),
    candidates: (recommendation.candidates ?? []).map((candidate) => {
      return {
        playerId: String(candidate.playerId),
        playerName: playerName(candidate.playerId, playerNames),
        suitabilityScore: candidate.suitabilityScore,
        role: candidate.currentRole,
        lifecycle: candidate.lifecycle,
        currentContribution: candidate.currentContribution,
        futureContribution: candidate.futureContribution,
        profile: candidate.developmentProfile,
        confidence: confidenceLabel(candidate.confidence)
      };
    }),
    reasons
  };
}

function mapProfile(
  assessment: ProfileDepthAssessment,
  players: readonly SquadDepthPlayer[],
  playerNames: ReadonlyMap<string, string>,
  recommendations: readonly SquadPriorityActionViewModel[]
): SquadProfileViewModel {
  const profilePlayers = players
    .filter((player) => playerMatchesProfile(player, assessment.profile))
    .map((player) => mapProfilePlayer(player, playerNames));
  const successors = assessment.succession.successorCandidates.map((candidate) =>
    mapSuccessor(candidate, playerNames)
  );
  const dependencyRisk = assessment.dependencyRisk
    ? {
        playerId: String(assessment.dependencyRisk.dominantPlayerId),
        playerName: playerName(assessment.dependencyRisk.dominantPlayerId, playerNames),
        contributionGap: formatContributionScore(assessment.dependencyRisk.contributionGap)
      }
    : null;
  const congestionReason = assessment.reasons.find(
    (reason): reason is Extract<SquadDepthReason, { type: "development_congestion" }> =>
      reason.type === "development_congestion"
  );

  return {
    profile: assessment.profile,
    profileLabel: profileLabel(assessment.profile),
    requirement: assessment.requirement,
    current: mapSnapshot(assessment.current),
    nextSeason: mapSnapshot(assessment.nextSeason),
    mediumTerm: mapSnapshot(assessment.mediumTerm),
    successionStatus: assessment.succession.coverageStatus,
    successionLabel: successionLabel(assessment.succession.coverageStatus),
    outgoingPlayers: assessment.succession.outgoingPlayers
      .map((playerId) => profilePlayers.find((player) => player.playerId === String(playerId)))
      .filter((player): player is SquadProfilePlayerViewModel => player !== undefined),
    successorCandidates: successors,
    players: profilePlayers,
    dependencyRisk,
    congestionMessage: congestionReason
      ? `${congestionReason.candidates} players are competing for approximately ${assessment.requirement.ideal} projected roles.`
      : null,
    missingPipeline: assessment.reasons.some(
      (reason) => reason.type === "prospect_pipeline_missing"
    ),
    reasons: assessment.reasons.map((reason) => mapDepthReason(reason, playerNames)),
    status: assessment.status,
    statusLabel: statusLabel(assessment.status),
    confidence: confidenceLabel(assessment.confidence),
    recommendations: recommendations.filter(
      (recommendation) => recommendation.profile === assessment.profile
    )
  };
}

function mapSnapshot(snapshot: ProfileDepthSnapshot): SquadDepthSnapshotViewModel {
  return {
    availablePlayers: snapshot.availablePlayers,
    strongOptions: snapshot.strongOptions,
    developingOptions: snapshot.developingOptions,
    prospects: snapshot.prospects,
    playerIds: snapshot.playerIds.map(String),
    depthScore: snapshot.depthScore
  };
}

function mapProfilePlayer(
  player: SquadDepthPlayer,
  playerNames: ReadonlyMap<string, string>
): SquadProfilePlayerViewModel {
  const group: SquadProfilePlayerGroup =
    player.role === "developing"
      ? "developing"
      : player.role === "prospect"
        ? "prospect"
        : player.role === "transition"
          ? "transition"
          : "current";

  return {
    playerId: String(player.playerId),
    name: playerName(player.playerId, playerNames),
    age: player.age ?? null,
    role: player.role,
    roleLabel: roleLabel(player.role),
    lifecycle: player.lifecycle,
    lifecycleLabel: lifecycleLabel(player.lifecycle),
    currentContribution: formatContributionScore(player.currentContributionScore),
    futureContribution: formatContributionScore(player.futureContributionScore),
    currentContributionScore: player.currentContributionScore,
    futureContributionScore: player.futureContributionScore,
    group,
    readiness: null
  };
}

function mapSuccessor(
  candidate: SuccessionCandidate,
  playerNames: ReadonlyMap<string, string>
): SquadSuccessionCandidateViewModel {
  return {
    playerId: String(candidate.playerId),
    playerName: playerName(candidate.playerId, playerNames),
    readiness: candidate.readiness,
    readinessLabel: READINESS_LABELS[candidate.readiness],
    estimatedReadyGameWeek: candidate.estimatedReadyGameWeek ?? null,
    confidence: confidenceLabel(candidate.confidence),
    predecessorPlayerId:
      candidate.predecessorPlayerId === undefined ? null : String(candidate.predecessorPlayerId)
  };
}

function recommendationDescription(
  recommendation: SquadPlanningRecommendation,
  reasons: readonly string[],
  playerNames: ReadonlyMap<string, string>
): string {
  if (recommendation.type === "find_external") {
    return (
      reasons[0] ?? "ATLAS identifies a structural need that the internal pipeline cannot cover."
    );
  }

  if (recommendation.type === "reprofile_player" && recommendation.playerIds[0] !== undefined) {
    const candidateName = playerName(recommendation.playerIds[0], playerNames);
    return `${candidateName} may offer a compatible profile while this squad structure has a future gap.`;
  }

  if (recommendation.type === "reduce_depth") {
    return reasons[0] ?? "The future pipeline contains more players than projected roles.";
  }

  return (
    reasons.slice(0, 2).join(" ") || "ATLAS has identified a structural squad planning signal."
  );
}

function createPlayerNames(rows: readonly SquadPlayerRow[]): Map<string, string> {
  return new Map(rows.map((row) => [row.playerId, row.playerName]));
}

function playerName(playerId: number, playerNames: ReadonlyMap<string, string>): string {
  return playerNames.get(String(playerId)) ?? `Player ${playerId}`;
}

function playerMatchesProfile(player: SquadDepthPlayer, profile: DevelopmentProfile): boolean {
  return (
    player.profile === profile ||
    player.fallbackProfile === profile ||
    player.compatibleProfiles?.includes(profile) === true ||
    player.profileContributions?.[profile] !== undefined
  );
}

function successionLabel(status: SuccessionCoverageStatus): string {
  return status === "covered" ? "Covered" : status === "at_risk" ? "At risk" : "Missing";
}

function comparePriorityActions(
  left: SquadPriorityActionViewModel,
  right: SquadPriorityActionViewModel
): number {
  return (
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
    left.profile.localeCompare(right.profile) ||
    left.id.localeCompare(right.id)
  );
}

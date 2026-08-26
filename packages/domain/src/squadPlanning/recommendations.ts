import type { Confidence } from "../types.js";
import type { DevelopmentProfile } from "../playerDevelopment/index.js";
import { SQUAD_DEPTH_PROFILE_ORDER } from "./depth-constants.js";
import type {
  ProfileDepthAssessment,
  SquadDepthPlayer,
  SquadPlanningHorizon,
  SuccessionCandidate
} from "./depth-types.js";
import { SQUAD_PLANNING_RECOMMENDATION_CONFIG } from "./recommendation-constants.js";
import type {
  SquadPlanningCandidate,
  SquadPlanningConflict,
  SquadPlanningReason,
  SquadPlanningRecommendation,
  SquadPlanningRecommendations,
  SquadPlanningRecommendationsInput,
  SquadPlanningRecommendationPriority,
  SquadPlanningRecommendationType
} from "./recommendation-types.js";
import type { SquadPlanningRecommendationConfig } from "./recommendation-types.js";

export * from "./recommendation-constants.js";
export * from "./recommendation-types.js";

export function generateSquadPlanningRecommendations(
  input: SquadPlanningRecommendationsInput
): SquadPlanningRecommendations {
  const config = resolveConfig(input.config);
  const playersById = new Map(input.players.map((player) => [player.playerId, player]));
  const assessments = [...input.depthAnalysis.profiles].sort(compareProfiles);
  const recommendations = assessments.flatMap((assessment) =>
    createProfileRecommendation(assessment, input.players, config)
  );
  const reprofileRecommendations = createReprofileRecommendations(
    assessments,
    input.players,
    config
  );
  const mergedRecommendations = replaceWithReprofileSolutions(
    recommendations,
    reprofileRecommendations
  );
  const stabilizedRecommendations = applyRecommendationStability(
    mergedRecommendations,
    input.previous ?? null,
    assessments,
    config
  );
  const conflicts = detectConflicts(stabilizedRecommendations);
  const recommendationsWithConflictHandling = applyConflictHandling(
    stabilizedRecommendations,
    conflicts
  );
  const orderedRecommendations = [...recommendationsWithConflictHandling].sort(
    compareRecommendations
  );

  return {
    recommendations: orderedRecommendations,
    conflicts,
    summary: buildSummary(orderedRecommendations, assessments, playersById)
  };
}

export class SquadPlanningRecommendationEngine {
  constructor(private readonly config: Partial<SquadPlanningRecommendationConfig> = {}) {}

  generate(input: Omit<SquadPlanningRecommendationsInput, "config">): SquadPlanningRecommendations {
    return generateSquadPlanningRecommendations({
      ...input,
      config: this.config
    });
  }
}

function resolveConfig(
  config: Partial<SquadPlanningRecommendationConfig> | undefined
): SquadPlanningRecommendationConfig {
  return {
    ...SQUAD_PLANNING_RECOMMENDATION_CONFIG,
    ...config
  };
}

function createProfileRecommendation(
  assessment: ProfileDepthAssessment,
  players: readonly SquadDepthPlayer[],
  config: SquadPlanningRecommendationConfig
): SquadPlanningRecommendation {
  const candidates = findInternalCandidates(assessment, players, config);
  const horizon = determineActionHorizon(assessment);
  const futureGap = hasFutureGap(assessment);
  const hasOverstock = assessment.status === "overstocked";
  const hasCongestion = hasReason(assessment, "development_congestion");
  const dependency = assessment.dependencyRisk;
  const successionNeedsAction =
    assessment.succession.successionRequired && assessment.succession.coverageStatus !== "covered";

  if (hasOverstock || hasCongestion) {
    return createReduceDepthRecommendation(assessment, players, horizon);
  }

  if (horizon === "current" && currentDepthIsBelowMinimum(assessment)) {
    if (candidates.length > 0) {
      return createInternalRecommendation(
        "develop_internal",
        assessment,
        candidates,
        horizon,
        "critical",
        [currentDepthReason(assessment), internalCandidateReason(candidates[0]!.playerId)]
      );
    }

    return createExternalRecommendation(assessment, horizon, "critical", [
      currentDepthReason(assessment),
      { type: "no_internal_candidate" }
    ]);
  }

  if (futureGap) {
    const lateSuccessor = findLateSuccessor(assessment, candidates, players, config);
    if (lateSuccessor) {
      return createInternalRecommendation(
        "accelerate_development",
        assessment,
        candidates,
        horizon,
        priorityForHorizon(horizon),
        [
          futureDepthReason(horizon),
          { type: "successor_not_ready_in_time", playerId: lateSuccessor.playerId },
          internalCandidateReason(lateSuccessor.playerId)
        ]
      );
    }

    if (candidates.length > 0) {
      return createInternalRecommendation(
        "develop_internal",
        assessment,
        candidates,
        horizon,
        priorityForHorizon(horizon),
        [futureDepthReason(horizon), internalCandidateReason(candidates[0]!.playerId)]
      );
    }

    return createExternalRecommendation(assessment, horizon, priorityForHorizon(horizon), [
      futureDepthReason(horizon),
      { type: "no_internal_candidate" },
      ...(assessment.succession.coverageStatus === "missing"
        ? ([{ type: "missing_successor" }] as const)
        : [])
    ]);
  }

  if (successionNeedsAction) {
    const lateSuccessor = findLateSuccessor(assessment, candidates, players, config);
    if (lateSuccessor) {
      return createInternalRecommendation(
        "accelerate_development",
        assessment,
        candidates,
        "medium_term",
        "medium",
        [
          successionReason(assessment),
          { type: "successor_not_ready_in_time", playerId: lateSuccessor.playerId },
          internalCandidateReason(lateSuccessor.playerId)
        ]
      );
    }

    if (candidates.length > 0) {
      return createInternalRecommendation(
        "prepare_successor",
        assessment,
        candidates,
        "medium_term",
        "medium",
        [successionReason(assessment), internalCandidateReason(candidates[0]!.playerId)]
      );
    }

    return createExternalRecommendation(assessment, "medium_term", "medium", [
      successionReason(assessment),
      { type: "no_internal_candidate" }
    ]);
  }

  if (dependency) {
    return createMonitorRecommendation(
      assessment,
      dependency.contributionGap >= config.dependencyHighGap ? "high" : "medium",
      [{ type: "single_player_dependency", playerId: dependency.dominantPlayerId }]
    );
  }

  if (hasLowConfidence(assessment, players)) {
    if (assessment.status === "thin" || assessment.status === "critical") {
      return createMonitorRecommendation(assessment, "medium", [
        { type: "low_confidence_projection" }
      ]);
    }
  }

  if (config.emitMaintainRecommendations) {
    return createMaintainRecommendation(assessment);
  }

  return createMonitorRecommendation(assessment, "low", [{ type: "healthy_profile" }]);
}

function createReprofileRecommendations(
  assessments: readonly ProfileDepthAssessment[],
  players: readonly SquadDepthPlayer[],
  config: SquadPlanningRecommendationConfig
): SquadPlanningRecommendation[] {
  const overstocked = assessments.filter(
    (assessment) =>
      assessment.status === "overstocked" || hasReason(assessment, "development_congestion")
  );
  const deficient = assessments.filter(
    (assessment) =>
      currentDepthIsBelowMinimum(assessment) ||
      hasFutureGap(assessment) ||
      assessment.succession.coverageStatus !== "covered"
  );

  return deficient
    .map((target) => {
      const candidate = players
        .filter((player) =>
          overstocked.some((source) =>
            isPrimaryPlayerForProfile(player, source.profile, source.current.playerIds)
          )
        )
        .map((player) => ({ player, score: explicitProfileScore(player, target.profile) }))
        .filter(
          (entry): entry is { player: SquadDepthPlayer; score: number } =>
            entry.score !== null && entry.score >= config.reprofileSuitabilityThreshold
        )
        .sort(
          (left, right) => right.score - left.score || left.player.playerId - right.player.playerId
        )[0];

      if (!candidate) return null;

      const sourceScore = explicitProfileScore(candidate.player, candidate.player.profile);
      if (
        sourceScore !== null &&
        candidate.score + config.reprofileAdvantageMargin < sourceScore &&
        candidate.player.role === "core"
      ) {
        return null;
      }

      const priority = priorityForHorizon(determineActionHorizon(target));
      return createRecommendation(
        "reprofile_player",
        target.profile,
        priority,
        determineActionHorizon(target),
        [candidate.player.playerId],
        candidate.player.playerId,
        confidenceForPlayers(target, [candidate.player]),
        [
          {
            type: "compatible_reprofile_candidate",
            playerId: candidate.player.playerId,
            targetProfile: target.profile
          },
          ...reprofileGapReasons(target)
        ],
        [toCandidate(candidate.player, candidateScore(candidate.player, candidate.score))]
      );
    })
    .filter(
      (recommendation): recommendation is SquadPlanningRecommendation => recommendation !== null
    );
}

function replaceWithReprofileSolutions(
  recommendations: readonly SquadPlanningRecommendation[],
  reprofileRecommendations: readonly SquadPlanningRecommendation[]
): SquadPlanningRecommendation[] {
  const replacements = new Map(
    reprofileRecommendations.map((recommendation) => [recommendation.profile, recommendation])
  );
  return recommendations.map(
    (recommendation) => replacements.get(recommendation.profile) ?? recommendation
  );
}

function createReduceDepthRecommendation(
  assessment: ProfileDepthAssessment,
  players: readonly SquadDepthPlayer[],
  horizon: SquadPlanningHorizon
): SquadPlanningRecommendation {
  const excess = assessment.requirement.maximum
    ? Math.max(1, Math.ceil(assessment.current.availablePlayers - assessment.requirement.maximum))
    : 1;
  const congestion = hasReason(assessment, "development_congestion")
    ? Math.max(
        1,
        Math.ceil(
          assessment.mediumTerm.prospects +
            assessment.mediumTerm.developingOptions -
            assessment.requirement.ideal
        )
      )
    : 0;
  const numberOfCandidates = Math.max(excess, congestion);
  const reductionPlayerIds = [
    ...new Set([...assessment.current.playerIds, ...assessment.succession.outgoingPlayers])
  ];
  const candidatePlayers = reductionPlayerIds
    .map((playerId) => players.find((player) => player.playerId === playerId))
    .filter((player): player is SquadDepthPlayer => player !== undefined)
    .sort(compareReductionCandidates)
    .slice(0, numberOfCandidates);
  const reasons: SquadPlanningReason[] = [];
  if (assessment.requirement.maximum !== undefined) {
    reasons.push({
      type: "profile_overstocked",
      count: assessment.current.availablePlayers,
      maximum: assessment.requirement.maximum
    });
  }
  if (hasReason(assessment, "development_congestion")) {
    reasons.push({ type: "development_congestion" });
  }

  return createRecommendation(
    "reduce_depth",
    assessment.profile,
    "medium",
    horizon,
    candidatePlayers.map((player) => player.playerId),
    undefined,
    confidenceForPlayers(assessment, candidatePlayers),
    reasons,
    candidatePlayers.map((player) => toCandidate(player, reductionSuitability(player)))
  );
}

function createInternalRecommendation(
  type: Extract<
    SquadPlanningRecommendationType,
    "develop_internal" | "accelerate_development" | "prepare_successor"
  >,
  assessment: ProfileDepthAssessment,
  candidates: readonly SquadPlanningCandidate[],
  horizon: SquadPlanningHorizon,
  priority: SquadPlanningRecommendationPriority,
  reasons: readonly SquadPlanningReason[]
): SquadPlanningRecommendation {
  return createRecommendation(
    type,
    assessment.profile,
    priority,
    horizon,
    candidates.map((candidate) => candidate.playerId),
    candidates[0]?.playerId,
    confidenceForCandidates(assessment, candidates),
    reasons,
    candidates
  );
}

function createExternalRecommendation(
  assessment: ProfileDepthAssessment,
  horizon: SquadPlanningHorizon,
  priority: SquadPlanningRecommendationPriority,
  reasons: readonly SquadPlanningReason[]
): SquadPlanningRecommendation {
  return createRecommendation(
    "find_external",
    assessment.profile,
    priority,
    horizon,
    [],
    undefined,
    assessment.confidence,
    reasons,
    undefined,
    { profile: assessment.profile, horizon, priority }
  );
}

function createMonitorRecommendation(
  assessment: ProfileDepthAssessment,
  priority: SquadPlanningRecommendationPriority,
  reasons: readonly SquadPlanningReason[]
): SquadPlanningRecommendation {
  return createRecommendation(
    "monitor",
    assessment.profile,
    priority,
    "medium_term",
    [],
    undefined,
    assessment.confidence,
    reasons
  );
}

function createMaintainRecommendation(
  assessment: ProfileDepthAssessment
): SquadPlanningRecommendation {
  return createRecommendation(
    "maintain",
    assessment.profile,
    "low",
    "current",
    [],
    undefined,
    assessment.confidence,
    [{ type: "healthy_profile" }]
  );
}

function createRecommendation(
  type: SquadPlanningRecommendationType,
  profile: DevelopmentProfile,
  priority: SquadPlanningRecommendationPriority,
  horizon: SquadPlanningHorizon,
  playerIds: readonly number[],
  targetPlayerId: number | undefined,
  confidence: Confidence,
  reasons: readonly SquadPlanningReason[],
  candidates?: readonly SquadPlanningCandidate[],
  need?: {
    profile: DevelopmentProfile;
    horizon: SquadPlanningHorizon;
    priority: SquadPlanningRecommendationPriority;
  }
): SquadPlanningRecommendation {
  return {
    id: `squad-planning:${profile}:${type}`,
    type,
    profile,
    priority,
    horizon,
    playerIds: [...playerIds].sort((left, right) => left - right),
    ...(targetPlayerId === undefined ? {} : { targetPlayerId }),
    confidence,
    reasons: uniqueReasons(reasons),
    ...(candidates === undefined ? {} : { candidates: [...candidates] }),
    ...(need === undefined ? {} : { need })
  };
}

function findInternalCandidates(
  assessment: ProfileDepthAssessment,
  players: readonly SquadDepthPlayer[],
  config: SquadPlanningRecommendationConfig
): SquadPlanningCandidate[] {
  const outgoing = new Set(assessment.succession.outgoingPlayers);
  const successorById = new Map(
    assessment.succession.successorCandidates.map((candidate) => [candidate.playerId, candidate])
  );
  return players
    .filter((player) => isCompatibleWithProfile(player, assessment.profile))
    .filter((player) => !outgoing.has(player.playerId) && player.role !== "transition")
    .filter((player) => isDevelopmentCandidate(player))
    .map((player) => {
      const score = profileFutureScore(player, assessment.profile);
      const successor = successorById.get(player.playerId);
      return {
        player,
        score,
        successor,
        candidate: toCandidate(player, candidateScore(player, score))
      };
    })
    .filter(
      (entry) =>
        entry.score !== null &&
        (entry.score >= config.internalCandidateThreshold ||
          entry.player.role === "prospect" ||
          entry.player.role === "developing")
    )
    .sort((left, right) => compareCandidateEntries(left, right))
    .map((entry) => entry.candidate);
}

function findLateSuccessor(
  assessment: ProfileDepthAssessment,
  candidates: readonly SquadPlanningCandidate[],
  players: readonly SquadDepthPlayer[],
  config: SquadPlanningRecommendationConfig
): SuccessionCandidate | null {
  const candidatesById = new Set(candidates.map((candidate) => candidate.playerId));
  const playersById = new Map(players.map((player) => [player.playerId, player]));
  const successors = assessment.succession.successorCandidates
    .filter((candidate) => candidatesById.has(candidate.playerId))
    .filter((candidate) => {
      const estimatedWeeks = playersById.get(candidate.playerId)?.projection?.completion
        .estimatedWeeks;
      return (
        estimatedWeeks !== null &&
        estimatedWeeks !== undefined &&
        estimatedWeeks > config.accelerateWindowWeeks &&
        estimatedWeeks <= config.mediumTermWeeks
      );
    })
    .sort(compareSuccessors);
  return successors[0] ?? null;
}

function toCandidate(
  player: SquadDepthPlayer,
  suitabilityScore: number | null
): SquadPlanningCandidate {
  return {
    playerId: player.playerId,
    suitabilityScore,
    currentRole: player.role,
    lifecycle: player.lifecycle,
    currentContribution: player.currentContributionScore,
    futureContribution: player.futureContributionScore,
    developmentProfile: player.profile,
    confidence: player.confidence
  };
}

function candidateScore(player: SquadDepthPlayer, profileScore: number | null): number | null {
  if (profileScore === null && player.futureContributionScore === null) return null;
  const future = profileScore ?? player.futureContributionScore ?? 0;
  const current = player.currentContributionScore ?? 0;
  const potential = player.developmentPotentialScore ?? future;
  const confidence = confidenceValue(player.confidence);
  return round(clamp(future * 0.45 + current * 0.2 + potential * 0.2 + confidence * 0.15, 0, 1));
}

function reductionSuitability(player: SquadDepthPlayer): number | null {
  const current = player.currentContributionScore;
  const future = player.futureContributionScore;
  if (current === null && future === null) return null;
  const roleFactor: Record<SquadDepthPlayer["role"], number> = {
    transition: 0,
    depth: 0.1,
    prospect: 0.35,
    developing: 0.5,
    rotation: 0.65,
    core: 1
  };
  const lifecycleFactor: Record<SquadDepthPlayer["lifecycle"], number> = {
    decline: 0,
    late_prime: 0.15,
    prospect: 0.35,
    development: 0.5,
    prime: 0.8
  };
  return round(
    clamp(
      (current ?? 0) * 0.4 +
        (future ?? 0) * 0.35 +
        roleFactor[player.role] * 0.15 +
        lifecycleFactor[player.lifecycle] * 0.1,
      0,
      1
    )
  );
}

function compareReductionCandidates(left: SquadDepthPlayer, right: SquadDepthPlayer): number {
  return (
    (reductionSuitability(left) ?? -1) - (reductionSuitability(right) ?? -1) ||
    left.playerId - right.playerId
  );
}

function compareCandidateEntries(
  left: {
    player: SquadDepthPlayer;
    score: number | null;
    successor: SuccessionCandidate | undefined;
    candidate: SquadPlanningCandidate;
  },
  right: {
    player: SquadDepthPlayer;
    score: number | null;
    successor: SuccessionCandidate | undefined;
    candidate: SquadPlanningCandidate;
  }
): number {
  const readiness = (entry: SuccessionCandidate | undefined): number =>
    entry?.readiness === "ready" ? 3 : entry?.readiness === "developing" ? 2 : 1;
  return (
    readiness(right.successor) - readiness(left.successor) ||
    (right.score ?? -1) - (left.score ?? -1) ||
    (right.candidate.suitabilityScore ?? -1) - (left.candidate.suitabilityScore ?? -1) ||
    left.player.playerId - right.player.playerId
  );
}

function compareSuccessors(left: SuccessionCandidate, right: SuccessionCandidate): number {
  const readiness = (candidate: SuccessionCandidate): number =>
    candidate.readiness === "developing" ? 2 : candidate.readiness === "ready" ? 3 : 1;
  return (
    readiness(right) - readiness(left) ||
    (right.futureContributionScore ?? -1) - (left.futureContributionScore ?? -1) ||
    left.playerId - right.playerId
  );
}

function determineActionHorizon(assessment: ProfileDepthAssessment): SquadPlanningHorizon {
  if (currentDepthIsBelowMinimum(assessment)) return "current";
  if (hasNextSeasonGap(assessment)) return "next_season";
  return "medium_term";
}

function priorityForHorizon(horizon: SquadPlanningHorizon): SquadPlanningRecommendationPriority {
  if (horizon === "current") return "critical";
  if (horizon === "next_season") return "high";
  return "medium";
}

function currentDepthIsBelowMinimum(assessment: ProfileDepthAssessment): boolean {
  return assessment.current.strongOptions < assessment.requirement.minimum;
}

function hasNextSeasonGap(assessment: ProfileDepthAssessment): boolean {
  return (
    assessment.nextSeason.strongOptions + assessment.nextSeason.developingOptions <
    assessment.requirement.minimum
  );
}

function hasFutureGap(assessment: ProfileDepthAssessment): boolean {
  return (
    hasNextSeasonGap(assessment) ||
    assessment.mediumTerm.strongOptions + assessment.mediumTerm.developingOptions <
      assessment.requirement.minimum
  );
}

function currentDepthReason(assessment: ProfileDepthAssessment): SquadPlanningReason {
  return {
    type: "current_depth_below_minimum",
    current: assessment.current.strongOptions,
    minimum: assessment.requirement.minimum
  };
}

function futureDepthReason(horizon: SquadPlanningHorizon): SquadPlanningReason {
  return { type: "future_depth_below_minimum", horizon };
}

function successionReason(assessment: ProfileDepthAssessment): SquadPlanningReason {
  return assessment.succession.coverageStatus === "missing"
    ? { type: "missing_successor" }
    : { type: "borderline_succession" };
}

function reprofileGapReasons(assessment: ProfileDepthAssessment): SquadPlanningReason[] {
  const reasons: SquadPlanningReason[] = [];
  if (currentDepthIsBelowMinimum(assessment)) reasons.push(currentDepthReason(assessment));
  if (hasFutureGap(assessment)) reasons.push(futureDepthReason(determineActionHorizon(assessment)));
  if (assessment.succession.coverageStatus === "missing")
    reasons.push({ type: "missing_successor" });
  return reasons;
}

function internalCandidateReason(playerId: number): SquadPlanningReason {
  return { type: "internal_candidate_available", playerId };
}

function hasReason(assessment: ProfileDepthAssessment, type: SquadPlanningReason["type"]): boolean {
  return assessment.reasons.some((reason) => reason.type === type);
}

function hasLowConfidence(
  assessment: ProfileDepthAssessment,
  players: readonly SquadDepthPlayer[]
): boolean {
  if (assessment.confidence === "low") return true;
  return assessment.current.playerIds.some(
    (playerId) => players.find((player) => player.playerId === playerId)?.confidence === "low"
  );
}

function isCompatibleWithProfile(player: SquadDepthPlayer, profile: DevelopmentProfile): boolean {
  return (
    player.profile === profile ||
    player.fallbackProfile === profile ||
    player.compatibleProfiles?.includes(profile) === true ||
    player.profileContributions?.[profile] !== undefined
  );
}

function isDevelopmentCandidate(player: SquadDepthPlayer): boolean {
  return (
    player.role === "prospect" ||
    player.role === "developing" ||
    player.lifecycle === "prospect" ||
    player.lifecycle === "development" ||
    (player.projection !== null && player.projection !== undefined) ||
    (player.developmentPotentialScore !== null && player.developmentPotentialScore !== undefined)
  );
}

function isPrimaryPlayerForProfile(
  player: SquadDepthPlayer,
  profile: DevelopmentProfile,
  playerIds: readonly number[]
): boolean {
  return playerIds.includes(player.playerId) && player.profile === profile;
}

function profileFutureScore(player: SquadDepthPlayer, profile: DevelopmentProfile): number | null {
  return player.profileContributions?.[profile] ?? player.futureContributionScore;
}

function explicitProfileScore(
  player: SquadDepthPlayer,
  profile: DevelopmentProfile | null
): number | null {
  if (profile === null) return null;
  return (
    player.profileContributions?.[profile] ??
    (player.profile === profile ? player.futureContributionScore : null)
  );
}

function applyRecommendationStability(
  recommendations: readonly SquadPlanningRecommendation[],
  previous: SquadPlanningRecommendations | null,
  assessments: readonly ProfileDepthAssessment[],
  config: SquadPlanningRecommendationConfig
): SquadPlanningRecommendation[] {
  if (!previous) return [...recommendations];
  const currentByProfile = new Map(
    assessments.map((assessment) => [assessment.profile, assessment])
  );
  return recommendations.map((recommendation) => {
    const previousRecommendation = previous.recommendations.find(
      (entry) => entry.profile === recommendation.profile && entry.type !== "maintain"
    );
    if (!previousRecommendation) return recommendation;
    const assessment = currentByProfile.get(recommendation.profile);
    if (!assessment || !isBorderlineAssessment(assessment, config)) return recommendation;
    if (recommendation.type === "maintain" || recommendation.type === "monitor") {
      return {
        ...previousRecommendation,
        reasons: uniqueReasons([...recommendation.reasons, ...previousRecommendation.reasons])
      };
    }
    return {
      ...recommendation,
      priority: maxPriority(recommendation.priority, previousRecommendation.priority),
      reasons: uniqueReasons([...recommendation.reasons, ...previousRecommendation.reasons])
    };
  });
}

function isBorderlineAssessment(
  assessment: ProfileDepthAssessment,
  config: SquadPlanningRecommendationConfig
): boolean {
  const currentDistance = Math.abs(
    assessment.current.strongOptions - assessment.requirement.minimum
  );
  const nextDistance = Math.abs(
    assessment.nextSeason.strongOptions +
      assessment.nextSeason.developingOptions -
      assessment.requirement.minimum
  );
  return (
    currentDistance <= config.stabilityMargin ||
    nextDistance <= config.stabilityMargin ||
    assessment.succession.coverageStatus === "at_risk"
  );
}

function detectConflicts(
  recommendations: readonly SquadPlanningRecommendation[]
): SquadPlanningConflict[] {
  const conflicts: SquadPlanningConflict[] = [];
  const developmentDemand = new Map<number, string[]>();
  const reductionDemand = new Map<number, string[]>();
  for (const recommendation of recommendations) {
    if (
      recommendation.type === "develop_internal" ||
      recommendation.type === "accelerate_development" ||
      recommendation.type === "prepare_successor" ||
      recommendation.type === "reprofile_player"
    ) {
      for (const playerId of recommendation.playerIds) {
        developmentDemand.set(playerId, [
          ...(developmentDemand.get(playerId) ?? []),
          recommendation.id
        ]);
      }
    }
    if (recommendation.type === "reduce_depth") {
      for (const playerId of recommendation.playerIds) {
        reductionDemand.set(playerId, [
          ...(reductionDemand.get(playerId) ?? []),
          recommendation.id
        ]);
      }
    }
  }
  for (const [playerId, recommendationIds] of developmentDemand) {
    if (recommendationIds.length > 1) {
      conflicts.push({
        playerId,
        recommendationIds: [...recommendationIds].sort(),
        type: "multiple_profile_demand"
      });
    }
    const reductions = reductionDemand.get(playerId);
    if (reductions && reductions.length > 0) {
      conflicts.push({
        playerId,
        recommendationIds: [...recommendationIds, ...reductions].sort(),
        type: "development_vs_depth_reduction"
      });
    }
  }
  return conflicts.sort(
    (left, right) => left.playerId - right.playerId || left.type.localeCompare(right.type)
  );
}

function applyConflictHandling(
  recommendations: readonly SquadPlanningRecommendation[],
  conflicts: readonly SquadPlanningConflict[]
): SquadPlanningRecommendation[] {
  const conflictedIds = new Set(conflicts.flatMap((conflict) => conflict.recommendationIds));
  return recommendations.map((recommendation) => {
    if (!conflictedIds.has(recommendation.id) || recommendation.type === "monitor") {
      return recommendation;
    }
    return {
      ...recommendation,
      type: "monitor",
      priority: lowerPriority(recommendation.priority),
      reasons: uniqueReasons([...recommendation.reasons, { type: "borderline_succession" }])
    };
  });
}

function buildSummary(
  recommendations: readonly SquadPlanningRecommendation[],
  assessments: readonly ProfileDepthAssessment[],
  playersById: ReadonlyMap<number, SquadDepthPlayer>
): SquadPlanningRecommendations["summary"] {
  const internalTypes = new Set<SquadPlanningRecommendationType>([
    "develop_internal",
    "accelerate_development",
    "prepare_successor",
    "reprofile_player"
  ]);
  const externalProfiles = new Set(
    recommendations
      .filter((recommendation) => recommendation.type === "find_external")
      .map((recommendation) => recommendation.profile)
  );
  const internalProfiles = new Set(
    recommendations
      .filter((recommendation) => internalTypes.has(recommendation.type))
      .map((recommendation) => recommendation.profile)
  );
  return {
    critical: recommendations.filter((recommendation) => recommendation.priority === "critical")
      .length,
    high: recommendations.filter((recommendation) => recommendation.priority === "high").length,
    medium: recommendations.filter((recommendation) => recommendation.priority === "medium").length,
    low: recommendations.filter((recommendation) => recommendation.priority === "low").length,
    profilesNeedingExternalHelp: externalProfiles.size,
    profilesWithInternalSolutions: internalProfiles.size,
    profilesOverstocked: assessments
      .filter((assessment) => assessment.status === "overstocked")
      .filter((assessment) =>
        assessment.current.playerIds.some((playerId) => playersById.has(playerId))
      ).length
  };
}

function confidenceForCandidates(
  assessment: ProfileDepthAssessment,
  candidates: readonly SquadPlanningCandidate[]
): Confidence {
  if (
    assessment.confidence === "low" ||
    candidates.some((candidate) => candidate.confidence === "low")
  ) {
    return "low";
  }
  if (
    assessment.confidence === "high" &&
    candidates.every((candidate) => candidate.confidence === "high")
  ) {
    return "high";
  }
  return "medium";
}

function confidenceForPlayers(
  assessment: ProfileDepthAssessment,
  players: readonly SquadDepthPlayer[]
): Confidence {
  if (assessment.confidence === "low" || players.some((player) => player.confidence === "low")) {
    return "low";
  }
  if (assessment.confidence === "high" && players.every((player) => player.confidence === "high")) {
    return "high";
  }
  return "medium";
}

function confidenceValue(confidence: Confidence): number {
  return confidence === "high" ? 1 : confidence === "medium" ? 0.65 : 0.3;
}

function maxPriority(
  left: SquadPlanningRecommendationPriority,
  right: SquadPlanningRecommendationPriority
): SquadPlanningRecommendationPriority {
  const rank: Record<SquadPlanningRecommendationPriority, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  };
  return rank[left] >= rank[right] ? left : right;
}

function lowerPriority(
  priority: SquadPlanningRecommendationPriority
): SquadPlanningRecommendationPriority {
  if (priority === "critical") return "high";
  if (priority === "high") return "medium";
  if (priority === "medium") return "low";
  return "low";
}

function compareProfiles(left: ProfileDepthAssessment, right: ProfileDepthAssessment): number {
  return profileOrder(left.profile) - profileOrder(right.profile);
}

function compareRecommendations(
  left: SquadPlanningRecommendation,
  right: SquadPlanningRecommendation
): number {
  const priorityRank: Record<SquadPlanningRecommendationPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };
  const horizonRank: Record<SquadPlanningHorizon, number> = {
    current: 3,
    next_season: 2,
    medium_term: 1
  };
  return (
    priorityRank[right.priority] - priorityRank[left.priority] ||
    horizonRank[right.horizon] - horizonRank[left.horizon] ||
    profileOrder(left.profile) - profileOrder(right.profile) ||
    left.type.localeCompare(right.type)
  );
}

function profileOrder(profile: DevelopmentProfile): number {
  const index = SQUAD_DEPTH_PROFILE_ORDER.indexOf(profile);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function uniqueReasons(reasons: readonly SquadPlanningReason[]): SquadPlanningReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = JSON.stringify(reason);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

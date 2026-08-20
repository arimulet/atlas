import type { Confidence } from "../types.js";
import type { DevelopmentProfile } from "../playerDevelopment/index.js";
import { SQUAD_DEPTH_CONFIG, SQUAD_PROFILE_REQUIREMENTS } from "./depth-constants.js";
import type {
  ProfileDepthAssessment,
  ProfileDepthSnapshot,
  ProfileDependencyRisk,
  ProfileSuccessionAssessment,
  SquadDepthAnalysis,
  SquadDepthAnalysisConfig,
  SquadDepthAnalysisInput,
  SquadDepthAnalysisOptions,
  SquadDepthPlayer,
  SquadDepthReason,
  SquadPlanningHorizon,
  SquadProfileRequirement,
  SuccessionReadiness
} from "./depth-types.js";
import type { SquadAssessment, SquadPlayerAssessment } from "./types.js";

export * from "./depth-constants.js";
export * from "./depth-types.js";

interface HorizonEvaluation {
  horizon: SquadPlanningHorizon;
  weeks: number;
  players: MatchedPlayer[];
  snapshot: ProfileDepthSnapshot;
}

interface MatchedPlayer {
  player: SquadDepthPlayer;
  score: number | null;
  weight: number;
  isPrimary: boolean;
  isOutgoing: boolean;
  lifecycle: SquadDepthPlayer["lifecycle"];
  readiness: SuccessionReadiness;
  estimatedReadyGameWeek: number | null;
}

export function analyzeSquadDepth(
  input: SquadDepthAnalysisInput | SquadAssessment | readonly SquadDepthPlayer[],
  options: SquadDepthAnalysisOptions | readonly SquadProfileRequirement[] = {}
): SquadDepthAnalysis {
  const normalizedOptions = normalizeDepthOptions(options);
  const normalized = normalizeInput(input, normalizedOptions);
  const config = resolveConfig(normalized.options);
  const requirements = normalizeRequirements(
    normalized.options.requirements ?? config.requirements
  );
  const profiles = requirements.map((requirement) =>
    analyzeProfile(requirement, normalized.players, normalized.options.currentGameWeek, config)
  );

  return {
    profiles,
    summary: {
      criticalProfiles: profiles.filter((profile) => profile.status === "critical").length,
      thinProfiles: profiles.filter((profile) => profile.status === "thin").length,
      balancedProfiles: profiles.filter((profile) => profile.status === "balanced").length,
      deepProfiles: profiles.filter((profile) => profile.status === "deep").length,
      overstockedProfiles: profiles.filter((profile) => profile.status === "overstocked").length,
      missingSuccessions: profiles.filter(
        (profile) => profile.succession.coverageStatus === "missing"
      ).length,
      dependencyRisks: profiles.filter((profile) => profile.dependencyRisk !== null).length
    }
  };
}

export class SquadDepthAnalyzer {
  constructor(private readonly config: Partial<SquadDepthAnalysisConfig> = {}) {}

  analyze(
    input: SquadDepthAnalysisInput | SquadAssessment | readonly SquadDepthPlayer[],
    options: SquadDepthAnalysisOptions | readonly SquadProfileRequirement[] = {}
  ): SquadDepthAnalysis {
    const normalizedOptions = normalizeDepthOptions(options);
    return analyzeSquadDepth(input, {
      ...normalizedOptions,
      config: { ...this.config, ...normalizedOptions.config }
    });
  }
}

function normalizeDepthOptions(
  options: SquadDepthAnalysisOptions | readonly SquadProfileRequirement[]
): SquadDepthAnalysisOptions {
  if (Array.isArray(options)) {
    return { requirements: options };
  }

  return options as SquadDepthAnalysisOptions;
}

function normalizeInput(
  input: SquadDepthAnalysisInput | SquadAssessment | readonly SquadDepthPlayer[],
  options: SquadDepthAnalysisOptions
): { players: SquadDepthPlayer[]; options: SquadDepthAnalysisOptions } {
  if (Array.isArray(input)) {
    return { players: input.map(toDepthPlayer), options };
  }

  const nonArrayInput = input as SquadAssessment | SquadDepthAnalysisInput;
  if (isDepthInput(nonArrayInput)) {
    return {
      players: nonArrayInput.players.map(toDepthPlayer),
      options: { ...nonArrayInput, ...options }
    };
  }

  return { players: nonArrayInput.players.map(toDepthPlayer), options };
}

function analyzeProfile(
  requirement: SquadProfileRequirement,
  players: readonly SquadDepthPlayer[],
  currentGameWeek: number | null | undefined,
  config: SquadDepthAnalysisConfig
): ProfileDepthAssessment {
  const current = evaluateHorizon(
    requirement.profile,
    players,
    "current",
    0,
    currentGameWeek,
    config
  );
  const nextSeason = evaluateHorizon(
    requirement.profile,
    players,
    "next_season",
    config.nextSeasonWeeks,
    currentGameWeek,
    config
  );
  const mediumTerm = evaluateHorizon(
    requirement.profile,
    players,
    "medium_term",
    config.mediumTermWeeks,
    currentGameWeek,
    config
  );
  const succession = analyzeSuccession(requirement, players, mediumTerm, currentGameWeek, config);
  const dependencyRisk = calculateDependencyRisk(requirement, current, config);
  const reasons = buildDepthReasons({
    requirement,
    current,
    nextSeason,
    mediumTerm,
    succession,
    dependencyRisk,
    players,
    config
  });
  const status = classifyDepthStatus({
    requirement,
    current,
    nextSeason,
    mediumTerm,
    succession,
    dependencyRisk,
    reasons,
    config
  });

  return {
    profile: requirement.profile,
    requirement,
    current: current.snapshot,
    nextSeason: nextSeason.snapshot,
    mediumTerm: mediumTerm.snapshot,
    succession,
    status,
    confidence: calculateDepthConfidence(current, nextSeason),
    dependencyRisk,
    reasons
  };
}

function evaluateHorizon(
  profile: DevelopmentProfile,
  players: readonly SquadDepthPlayer[],
  horizon: SquadPlanningHorizon,
  weeks: number,
  currentGameWeek: number | null | undefined,
  config: SquadDepthAnalysisConfig
): HorizonEvaluation {
  const matchedPlayers = players
    .map((player) => matchPlayerToProfile(player, profile, horizon, weeks, currentGameWeek, config))
    .filter((player): player is MatchedPlayer => player !== null)
    .sort(compareMatchedPlayers);
  const available = matchedPlayers.filter((player) => !player.isOutgoing);
  const strongOptions = sumWeights(
    available.filter((player) => (player.score ?? 0) >= config.strongOptionThreshold)
  );
  const developingOptions = sumWeights(
    available.filter(
      (player) =>
        (player.score ?? 0) >= config.developingOptionThreshold &&
        (player.score ?? 0) < config.strongOptionThreshold &&
        (player.player.role === "developing" || player.lifecycle === "development")
    )
  );
  const prospects = sumWeights(
    available.filter(
      (player) => player.player.role === "prospect" || player.lifecycle === "prospect"
    )
  );
  const playerIds = uniqueSortedIds(available.map((player) => player.player.playerId));

  return {
    horizon,
    weeks,
    players: matchedPlayers,
    snapshot: {
      availablePlayers: roundMetric(sumWeights(available)),
      strongOptions: roundMetric(strongOptions),
      developingOptions: roundMetric(developingOptions),
      prospects: roundMetric(prospects),
      playerIds,
      depthScore: calculateDepthScore(strongOptions, developingOptions, prospects, playerIds.length)
    }
  };
}

function matchPlayerToProfile(
  player: SquadDepthPlayer,
  profile: DevelopmentProfile,
  horizon: SquadPlanningHorizon,
  weeks: number,
  currentGameWeek: number | null | undefined,
  config: SquadDepthAnalysisConfig
): MatchedPlayer | null {
  const match = profileMatch(player, profile, config);
  if (!match) return null;

  const score =
    !match.isPrimary && player.profileContributions?.[profile] !== undefined
      ? (player.profileContributions[profile] ?? null)
      : projectedScore(player, horizon, weeks);
  const lifecycle = projectedLifecycle(player, horizon, score, config);
  const isOutgoing = isOutgoingPlayer(player, horizon, score, lifecycle, config);
  const readiness = readinessFor(player, horizon, weeks, score, config);
  const estimatedReadyGameWeek = readinessGameWeek(player);

  return {
    player,
    score,
    weight: match.weight,
    isPrimary: match.isPrimary,
    isOutgoing,
    lifecycle,
    readiness,
    estimatedReadyGameWeek:
      currentGameWeek !== null && currentGameWeek !== undefined && estimatedReadyGameWeek !== null
        ? estimatedReadyGameWeek
        : null
  };
}

function profileMatch(
  player: SquadDepthPlayer,
  profile: DevelopmentProfile,
  config: SquadDepthAnalysisConfig
): { weight: number; isPrimary: boolean } | null {
  if (player.profile === profile) return { weight: 1, isPrimary: true };
  if (!player.profile && formationFallback(player.formation) === profile) {
    return { weight: 1, isPrimary: true };
  }
  if (!player.profile && player.fallbackProfile === profile) {
    return { weight: 1, isPrimary: true };
  }
  if (player.compatibleProfiles?.includes(profile)) {
    return { weight: config.secondaryProfileWeight, isPrimary: false };
  }
  if (player.profileContributions?.[profile] !== undefined) {
    return { weight: config.secondaryProfileWeight, isPrimary: false };
  }
  return null;
}

function formationFallback(formation: SquadDepthPlayer["formation"]): DevelopmentProfile | null {
  if (formation === "GK") return "goalkeeper";
  if (formation === "DEF") return "central_defender";
  if (formation === "MID") return "central_midfielder";
  if (formation === "ATT") return "forward";
  return null;
}

function projectedScore(
  player: SquadDepthPlayer,
  horizon: SquadPlanningHorizon,
  weeks: number
): number | null {
  if (horizon === "current") return player.currentContributionScore;
  const current = player.currentContributionScore;
  const future = player.futureContributionScore;
  if (current === null && future === null) return null;
  if (current === null) return future;
  if (future === null || future === current) return current;

  const completionWeeks = player.projection?.completion.estimatedWeeks;
  if (completionWeeks !== null && completionWeeks !== undefined && completionWeeks > 0) {
    return clamp(current + (future - current) * clamp(weeks / completionWeeks, 0, 1), 0, 1);
  }
  if (completionWeeks === 0) return future;

  const horizonProgress = horizon === "next_season" ? 0.5 : 0.75;
  return clamp(current + (future - current) * horizonProgress, 0, 1);
}

function projectedLifecycle(
  player: SquadDepthPlayer,
  horizon: SquadPlanningHorizon,
  score: number | null,
  config: SquadDepthAnalysisConfig
): SquadDepthPlayer["lifecycle"] {
  if (horizon === "current" || player.lifecycle === "decline") {
    return player.lifecycle;
  }
  if (
    (player.lifecycle === "prospect" || player.lifecycle === "development") &&
    (score ?? 0) >= config.strongOptionThreshold
  ) {
    return "prime";
  }
  return player.lifecycle;
}

function isOutgoingPlayer(
  player: SquadDepthPlayer,
  horizon: SquadPlanningHorizon,
  score: number | null,
  lifecycle: SquadDepthPlayer["lifecycle"],
  config: SquadDepthAnalysisConfig
): boolean {
  if (horizon === "current") {
    return player.role === "transition" && lifecycle !== "prime";
  }
  if (player.role === "transition" || lifecycle === "decline") return true;
  if (lifecycle === "late_prime" && (score ?? 0) < config.strongOptionThreshold) return true;
  return (
    (player.currentContributionScore ?? 0) >= config.strongOptionThreshold &&
    (score ?? 0) < config.developingOptionThreshold
  );
}

function readinessFor(
  player: SquadDepthPlayer,
  horizon: SquadPlanningHorizon,
  weeks: number,
  score: number | null,
  config: SquadDepthAnalysisConfig
): SuccessionReadiness {
  if ((player.currentContributionScore ?? 0) >= config.strongOptionThreshold) return "ready";
  if (
    horizon !== "current" &&
    (player.projection?.completion.estimatedWeeks === null ||
    player.projection?.completion.estimatedWeeks === undefined
      ? (score ?? 0) >= config.strongOptionThreshold
      : player.projection.completion.estimatedWeeks <= weeks)
  ) {
    return "developing";
  }
  return "long_term";
}

function readinessGameWeek(player: SquadDepthPlayer): number | null {
  return player.projection?.completion.estimatedGameWeek ?? null;
}

function analyzeSuccession(
  requirement: SquadProfileRequirement,
  players: readonly SquadDepthPlayer[],
  mediumTerm: HorizonEvaluation,
  currentGameWeek: number | null | undefined,
  config: SquadDepthAnalysisConfig
): ProfileSuccessionAssessment {
  const currentMatches = players
    .map((player) => {
      const match = profileMatch(player, requirement.profile, config);
      if (!match) return null;
      const medium = mediumTerm.players.find((entry) => entry.player.playerId === player.playerId);
      return { player, match, medium };
    })
    .filter(
      (
        entry
      ): entry is {
        player: SquadDepthPlayer;
        match: { weight: number; isPrimary: boolean };
        medium: MatchedPlayer;
      } => entry?.medium !== undefined
    );
  const outgoingPlayers = currentMatches
    .filter((entry) => entry.medium.isOutgoing)
    .map((entry) => entry.player.playerId)
    .sort((left, right) => left - right);
  const candidateEntries = currentMatches
    .filter((entry) => !outgoingPlayers.includes(entry.player.playerId))
    .filter((entry) => {
      const score = entry.medium.score ?? 0;
      return (
        score >= config.futureOptionThreshold ||
        entry.player.role === "prospect" ||
        entry.player.role === "developing"
      );
    })
    .sort((left, right) => compareCandidates(left.medium, right.medium));
  const successorCandidates = candidateEntries.map((entry, index) => ({
    playerId: entry.player.playerId,
    ...(outgoingPlayers.length > 0
      ? { predecessorPlayerId: outgoingPlayers[index % outgoingPlayers.length] }
      : {}),
    readiness: entry.medium.readiness,
    estimatedReadyGameWeek: entry.medium.estimatedReadyGameWeek,
    currentContributionScore: entry.player.currentContributionScore,
    futureContributionScore: entry.player.futureContributionScore,
    confidence: successionConfidence(entry.player, entry.medium, currentGameWeek)
  }));
  const successionRequired =
    outgoingPlayers.length > 0 ||
    mediumTerm.snapshot.strongOptions + mediumTerm.snapshot.developingOptions < requirement.minimum;
  const usableCandidates = successorCandidates.filter(
    (candidate) => candidate.readiness !== "long_term"
  ).length;
  const coverageStatus: ProfileSuccessionAssessment["coverageStatus"] = !successionRequired
    ? "covered"
    : usableCandidates >= outgoingPlayers.length && usableCandidates > 0
      ? "covered"
      : successorCandidates.length > 0
        ? "at_risk"
        : "missing";

  return {
    successionRequired,
    outgoingPlayers,
    successorCandidates,
    coverageStatus
  };
}

function calculateDependencyRisk(
  requirement: SquadProfileRequirement,
  current: HorizonEvaluation,
  config: SquadDepthAnalysisConfig
): ProfileDependencyRisk | null {
  const options = current.players
    .filter((player) => !player.isOutgoing && player.isPrimary && player.score !== null)
    .sort(
      (left, right) =>
        (right.score ?? 0) - (left.score ?? 0) || left.player.playerId - right.player.playerId
    );
  const dominant = options[0];
  if (!dominant || (dominant.score ?? 0) < config.strongOptionThreshold) return null;
  if (options.length === 1 && requirement.minimum <= 1) return null;
  const nextBestScore = options[1]?.score ?? 0;
  const contributionGap = roundMetric((dominant.score ?? 0) - nextBestScore);
  return contributionGap >= config.singlePlayerDependencyGap
    ? { dominantPlayerId: dominant.player.playerId, contributionGap }
    : null;
}

function buildDepthReasons(input: {
  requirement: SquadProfileRequirement;
  current: HorizonEvaluation;
  nextSeason: HorizonEvaluation;
  mediumTerm: HorizonEvaluation;
  succession: ProfileSuccessionAssessment;
  dependencyRisk: ProfileDependencyRisk | null;
  players: readonly SquadDepthPlayer[];
  config: SquadDepthAnalysisConfig;
}): SquadDepthReason[] {
  const reasons: SquadDepthReason[] = [];
  const currentCompetitive = input.current.snapshot.strongOptions;
  const nextCompetitive =
    input.nextSeason.snapshot.strongOptions + input.nextSeason.snapshot.developingOptions;
  const mediumCompetitive =
    input.mediumTerm.snapshot.strongOptions + input.mediumTerm.snapshot.developingOptions;
  const futurePipeline =
    input.mediumTerm.snapshot.prospects + input.mediumTerm.snapshot.developingOptions;
  const futureCapacity = Math.max(
    input.requirement.ideal - input.mediumTerm.snapshot.strongOptions,
    0
  );
  const congestion = Math.max(
    0,
    futurePipeline - futureCapacity - input.config.futurePipelineCapacityBuffer
  );
  const orphanProspects = findOrphanProspects(input, congestion);

  if (currentCompetitive < input.requirement.minimum) {
    reasons.push({
      type: "below_minimum_depth",
      current: currentCompetitive,
      minimum: input.requirement.minimum
    });
  }
  if (nextCompetitive < input.requirement.minimum) {
    reasons.push({ type: "future_depth_below_minimum", horizon: "next_season" });
  } else {
    reasons.push({ type: "future_depth_healthy", horizon: "next_season" });
  }
  if (mediumCompetitive < input.requirement.minimum) {
    reasons.push({ type: "future_depth_below_minimum", horizon: "medium_term" });
  } else {
    reasons.push({ type: "future_depth_healthy", horizon: "medium_term" });
  }
  if (input.dependencyRisk) {
    reasons.push({
      type: "single_player_dependency",
      playerId: input.dependencyRisk.dominantPlayerId
    });
  }
  if (input.succession.coverageStatus === "missing") {
    reasons.push({
      type: "missing_successor",
      ...(input.succession.outgoingPlayers[0] !== undefined
        ? { playerId: input.succession.outgoingPlayers[0] }
        : {})
    });
  } else if (input.succession.coverageStatus === "covered") {
    const successor = input.succession.successorCandidates[0];
    if (successor)
      reasons.push({ type: "succession_covered", successorPlayerId: successor.playerId });
  }
  const lateLifecycleCount = input.current.players.filter(
    (player) =>
      player.lifecycle === "late_prime" ||
      player.lifecycle === "decline" ||
      player.player.role === "transition"
  ).length;
  if (lateLifecycleCount >= input.config.lateLifecycleConcentrationMinimum) {
    reasons.push({ type: "late_lifecycle_concentration" });
  }
  if (congestion > 0) {
    reasons.push({ type: "development_congestion", candidates: futurePipeline });
    reasons.push(
      ...orphanProspects.map((playerId) => ({ type: "orphan_prospect" as const, playerId }))
    );
  }
  if (
    input.mediumTerm.snapshot.prospects + input.mediumTerm.snapshot.developingOptions === 0 &&
    input.succession.successionRequired
  ) {
    reasons.push({ type: "prospect_pipeline_missing" });
  }
  if (
    input.requirement.maximum !== undefined &&
    input.current.snapshot.availablePlayers > input.requirement.maximum
  ) {
    reasons.push({ type: "overstocked_profile" });
  }
  const riskTypes = new Set<SquadDepthReason["type"]>([
    "below_minimum_depth",
    "single_player_dependency",
    "missing_successor",
    "late_lifecycle_concentration",
    "development_congestion",
    "prospect_pipeline_missing",
    "overstocked_profile",
    "future_depth_below_minimum",
    "orphan_prospect"
  ]);
  if (!reasons.some((reason) => riskTypes.has(reason.type))) {
    reasons.push({ type: "healthy_depth" });
  }
  return uniqueDepthReasons(reasons);
}

function findOrphanProspects(
  input: {
    requirement: SquadProfileRequirement;
    mediumTerm: HorizonEvaluation;
  },
  congestion: number
): number[] {
  if (congestion <= 0) return [];
  const prospects = input.mediumTerm.players
    .filter(
      (player) =>
        !player.isOutgoing && (player.player.role === "prospect" || player.lifecycle === "prospect")
    )
    .sort(
      (left, right) =>
        (left.score ?? 0) - (right.score ?? 0) || left.player.playerId - right.player.playerId
    );
  return prospects.slice(0, Math.ceil(congestion)).map((player) => player.player.playerId);
}

function classifyDepthStatus(input: {
  requirement: SquadProfileRequirement;
  current: HorizonEvaluation;
  nextSeason: HorizonEvaluation;
  mediumTerm: HorizonEvaluation;
  succession: ProfileSuccessionAssessment;
  dependencyRisk: ProfileDependencyRisk | null;
  reasons: readonly SquadDepthReason[];
  config: SquadDepthAnalysisConfig;
}): ProfileDepthAssessment["status"] {
  const currentCompetitive = input.current.snapshot.strongOptions;
  const nextCompetitive =
    input.nextSeason.snapshot.strongOptions + input.nextSeason.snapshot.developingOptions;
  const mediumCompetitive =
    input.mediumTerm.snapshot.strongOptions + input.mediumTerm.snapshot.developingOptions;
  const overstocked = input.reasons.some((reason) => reason.type === "overstocked_profile");
  const congestion = input.reasons.some((reason) => reason.type === "development_congestion");
  const critical =
    currentCompetitive < input.requirement.minimum &&
    mediumCompetitive < input.requirement.minimum &&
    input.succession.coverageStatus === "missing";
  if (critical) return "critical";
  if (overstocked && currentCompetitive >= input.requirement.minimum) return "overstocked";
  if (
    currentCompetitive < input.requirement.minimum ||
    nextCompetitive < input.requirement.minimum ||
    mediumCompetitive < input.requirement.minimum ||
    input.succession.coverageStatus === "at_risk" ||
    input.dependencyRisk !== null
  ) {
    return "thin";
  }
  if (congestion && currentCompetitive < input.requirement.ideal) return "balanced";
  if (
    input.current.snapshot.availablePlayers > input.requirement.ideal &&
    (input.requirement.maximum === undefined ||
      input.current.snapshot.availablePlayers <= input.requirement.maximum)
  ) {
    return "deep";
  }
  return "balanced";
}

function calculateDepthScore(
  strongOptions: number,
  developingOptions: number,
  prospects: number,
  availablePlayers: number
): number | null {
  if (availablePlayers === 0) return null;
  return roundMetric(
    clamp(strongOptions * 0.6 + developingOptions * 0.25 + prospects * 0.15, 0, availablePlayers) /
      availablePlayers
  );
}

function calculateDepthConfidence(
  current: HorizonEvaluation,
  nextSeason: HorizonEvaluation
): Confidence {
  const currentConfidence = aggregateConfidence(current.players.map((player) => player.player));
  const nextConfidence = reduceConfidence(
    aggregateConfidence(nextSeason.players.map((player) => player.player)),
    1
  );
  const mediumConfidence = reduceConfidence(nextConfidence, 1);
  if (currentConfidence === "low") return "low";
  if (mediumConfidence === "high") return "high";
  if (nextConfidence === "low" || mediumConfidence === "low") return "low";
  return "medium";
}

function aggregateConfidence(players: readonly SquadDepthPlayer[]): Confidence {
  if (players.length === 0) return "low";
  if (players.every((player) => player.confidence === "high")) return "high";
  if (players.some((player) => player.confidence !== "low")) return "medium";
  return "low";
}

function reduceConfidence(confidence: Confidence, steps: number): Confidence {
  const order: Confidence[] = ["low", "medium", "high"];
  return order[Math.max(0, order.indexOf(confidence) - steps)] ?? "low";
}

function successionConfidence(
  player: SquadDepthPlayer,
  medium: MatchedPlayer,
  currentGameWeek: number | null | undefined
): Confidence {
  if (medium.readiness === "ready") return player.confidence;
  if (medium.estimatedReadyGameWeek !== null && currentGameWeek !== null) {
    return reduceConfidence(player.confidence, 1);
  }
  return reduceConfidence(player.confidence, 1);
}

function compareMatchedPlayers(left: MatchedPlayer, right: MatchedPlayer): number {
  return (
    (right.score ?? -1) - (left.score ?? -1) ||
    right.weight - left.weight ||
    left.player.playerId - right.player.playerId
  );
}

function compareCandidates(left: MatchedPlayer, right: MatchedPlayer): number {
  const readinessRank: Record<SuccessionReadiness, number> = {
    ready: 3,
    developing: 2,
    long_term: 1
  };
  return (
    readinessRank[right.readiness] - readinessRank[left.readiness] ||
    (right.score ?? -1) - (left.score ?? -1) ||
    left.player.playerId - right.player.playerId
  );
}

function normalizeRequirements(
  requirements: readonly SquadProfileRequirement[]
): SquadProfileRequirement[] {
  return [...requirements]
    .filter(
      (requirement) =>
        requirement.minimum >= 0 &&
        requirement.ideal >= requirement.minimum &&
        (requirement.maximum === undefined || requirement.maximum >= requirement.ideal)
    )
    .sort((left, right) => profileOrder(left.profile) - profileOrder(right.profile));
}

function resolveConfig(options: SquadDepthAnalysisOptions): SquadDepthAnalysisConfig {
  return {
    ...SQUAD_DEPTH_CONFIG,
    ...options.config,
    requirements: options.requirements ?? options.config?.requirements ?? SQUAD_PROFILE_REQUIREMENTS
  };
}

function toDepthPlayer(player: SquadDepthPlayer | SquadPlayerAssessment): SquadDepthPlayer {
  return player;
}

function isDepthInput(
  input: SquadDepthAnalysisInput | SquadAssessment
): input is SquadDepthAnalysisInput {
  return Object.hasOwn(input, "players") && !Object.hasOwn(input, "summary");
}

function profileOrder(profile: DevelopmentProfile): number {
  return SQUAD_PROFILE_REQUIREMENTS.findIndex((requirement) => requirement.profile === profile);
}

function sumWeights(players: readonly MatchedPlayer[]): number {
  return players.reduce((total, player) => total + player.weight, 0);
}

function uniqueSortedIds(ids: readonly number[]): number[] {
  return [...new Set(ids)].sort((left, right) => left - right);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function uniqueDepthReasons(reasons: readonly SquadDepthReason[]): SquadDepthReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = JSON.stringify(reason);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

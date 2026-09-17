import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedClub,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot
} from "@atlas/database";
import { buildClubOperatingSettings, Category, ClubId, Confidence, DeltaDirection, getSquadMarketPlanning, SquadMarketPlanning, SquadMarketPlayerPlan, Severity, SkillKey } from "@atlas/application";
import { formatDate } from "@atlas/utils";

import type {
  ComparablePlayerPoint,
  DevelopmentEvidence,
  PlayerDevelopment,
  PlayerDevelopmentFinding,
  PlayerDevelopmentObservedPlayer,
  PlayerDevelopmentPlayerSummary,
  PlayerDevelopmentSignal,
  PlayerDevelopmentWarning,
  PlayerSkillChange,
  YouthPipelineObservedPlayer,
  YouthPipelinePlanning,
  YouthPipelinePlayerContext,
  YouthPipelinePlayerPlan,
  YouthPipelineSignal,
  YouthPipelineWarning
} from "./types";
// import { getSquadMarketPlanning } from "../marketPlanning/index.js";
// import { SquadMarketPlayerPlan } from "../marketPlanning/types.js";
// import { Category, ClubId, Confidence, DeltaDirection } from "../types.js";

const skillKeys: SkillKey[] = [
  "stamina",
  "pace",
  "technique",
  "passing",
  "keeper",
  "defender",
  "playmaker",
  "striker"
];

export const YOUTH_PIPELINE_AGE_THRESHOLD = 23;

const roleRelevantSkills: Record<string, SkillKey[]> = {
  goalkeeper: ["keeper", "pace", "passing"],
  defender: ["defender", "pace", "technique", "passing"],
  midfielder: ["playmaker", "passing", "technique", "pace"],
  winger: ["pace", "technique", "passing", "playmaker"],
  striker: ["striker", "pace", "technique"],
  trainee: ["pace", "technique", "passing", "playmaker", "striker", "defender"],
  undefined: ["pace", "technique", "passing", "playmaker"]
};

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export const getPlayerDevelopmentFromLoadedData = (
  clubId: ClubId,
  club: PersistedClub,
  snapshots: PersistedSnapshot[]
): PlayerDevelopment => {
  const latest = snapshots.at(-1) ?? null;
  const trainingPriority =
    buildClubOperatingSettings(club).effective.preferences["training.priority"];
  const warnings = buildGlobalWarnings(snapshots);

  if (!latest) {
    return {
      clubId: clubId,
      snapshotCount: 0,
      snapshotDates: [],
      observed: {
        latestSnapshotId: null,
        latestSnapshotDate: null,
        players: []
      },
      manual: { trainingPriority },
      derived: { players: [] },
      warnings
    };
  }

  return {
    clubId: clubId,
    snapshotCount: snapshots.length,
    snapshotDates: snapshots.map((snapshot) => formatDate(snapshot.snapshotDate)),
    observed: {
      latestSnapshotId: latest.id,
      latestSnapshotDate: formatDate(latest.snapshotDate),
      players: latest.players.map(mapObservedPlayer)
    },
    manual: { trainingPriority },
    derived: {
      players: buildPlayerSummaries(snapshots, latest, trainingPriority)
    },
    warnings
  };
};

const inFlightPlayerDevelopments = new Map<string, Promise<PlayerDevelopment>>();
const playerDevelopmentCache = new Map<string, { data: PlayerDevelopment; timestamp: number }>();
const PLAYER_DEVELOPMENT_CACHE_TTL_MS = 60 * 1000;

export function invalidatePlayerDevelopmentCache(clubId?: ClubId): void {
  if (clubId !== undefined) {
    playerDevelopmentCache.delete(String(clubId));
  } else {
    playerDevelopmentCache.clear();
  }
}

export const getPlayerDevelopment = async (clubId: ClubId): Promise<PlayerDevelopment> => {
  const cacheKey = String(clubId);
  const now = Date.now();

  const cached = playerDevelopmentCache.get(cacheKey);
  if (cached && now - cached.timestamp < PLAYER_DEVELOPMENT_CACHE_TTL_MS) {
    return cached.data;
  }

  const inFlight = inFlightPlayerDevelopments.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      const club = await clubRepository.findById(clubId.toString());
      if (!club) {
        throw new Error(`Club not found: ${clubId}`);
      }

      const snapshots = await snapshotRepository.listByClub(club.clubId);
      const data = getPlayerDevelopmentFromLoadedData(clubId, club, snapshots);
      playerDevelopmentCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } finally {
      inFlightPlayerDevelopments.delete(cacheKey);
    }
  })();

  inFlightPlayerDevelopments.set(cacheKey, promise);
  return promise;
};

export interface YouthPipelinePlanningOptions {
  club?: PersistedClub;
  snapshots?: PersistedSnapshot[];
  development?: PlayerDevelopment;
  marketPlanning?: SquadMarketPlanning;
}

const inFlightYouthPipeline = new Map<string, Promise<YouthPipelinePlanning>>();
const youthPipelineCache = new Map<string, { data: YouthPipelinePlanning; timestamp: number }>();
const YOUTH_PIPELINE_CACHE_TTL_MS = 60 * 1000;

export function invalidateYouthPipelineCache(clubId?: ClubId): void {
  if (clubId !== undefined) {
    youthPipelineCache.delete(String(clubId));
  } else {
    youthPipelineCache.clear();
  }
}

export const getYouthPipelinePlanning = async (
  clubId: ClubId,
  options?: YouthPipelinePlanningOptions
): Promise<YouthPipelinePlanning> => {
  const hasCustomOptions = Boolean(
    options?.club || options?.snapshots || options?.development || options?.marketPlanning
  );
  const cacheKey = String(clubId);

  if (!hasCustomOptions) {
    const cached = youthPipelineCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < YOUTH_PIPELINE_CACHE_TTL_MS) {
      return cached.data;
    }

    const existingInFlight = inFlightYouthPipeline.get(cacheKey);
    if (existingInFlight) {
      return existingInFlight;
    }
  }

  const compute = async (): Promise<YouthPipelinePlanning> => {
    const club = options?.club ?? (await clubRepository.findById(clubId.toString()));

    if (!club) {
      throw new Error(`Club not found: ${clubId}`);
    }

    const operatingSettings = buildClubOperatingSettings(club);
    const academyInvestment = operatingSettings.effective.preferences["academy.investment"];
    const effectiveCurrency = club.currency;
    const snapshots = options?.snapshots ?? (await snapshotRepository.listByClub(club.clubId));
    const latest = snapshots.at(-1) ?? null;

    if (!latest) {
      return buildEmptyPlanning(clubId, academyInvestment);
    }

    const development =
      options?.development ?? getPlayerDevelopmentFromLoadedData(clubId, club, snapshots);
    const marketPlanning =
      options?.marketPlanning ??
      (await getSquadMarketPlanning(clubId, {
        club,
        snapshots,
        development
      }));
    const developmentIndex = buildDevelopmentIndex(development.derived.players);
    const marketIndex = buildMarketIndex(marketPlanning.derived.players);
    const youngPlayers = latest.players.filter(
      (player) => player.age <= YOUTH_PIPELINE_AGE_THRESHOLD
    );
    const plans = youngPlayers
      .map((player) =>
        buildPlayerPlan({
          player,
          snapshots,
          academyInvestment,
          currency: effectiveCurrency,
          developmentSummary: findDevelopmentSummary(player, developmentIndex),
          marketPlan: marketIndex.get(player.id) ?? null
        })
      )
      .sort(comparePlayerPlans);

    const result: YouthPipelinePlanning = {
      clubId,
      snapshotId: latest.id,
      snapshotDate: formatDate(latest.snapshotDate),
      observed: {
        youthAgeThreshold: YOUTH_PIPELINE_AGE_THRESHOLD,
        players: youngPlayers.map((player) => mapObservedYouth(player, effectiveCurrency)),
        coverage: {
          seniorPlayerCount: latest.players.length,
          youngSeniorPlayerCount: youngPlayers.length,
          playersWithStableIdentity: youngPlayers.filter((player) => Boolean(player.playerId))
            .length,
          playersWithCompleteSkills: youngPlayers.filter(hasCompleteSkills).length
        }
      },
      manual: { academyInvestment },
      derived: {
        categoryCounts: countCategories(plans),
        players: plans
      },
      warnings: buildGlobalYouthWarnings(latest, snapshots, youngPlayers)
    };

    if (!hasCustomOptions) {
      youthPipelineCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return result;
  };

  if (hasCustomOptions) {
    return compute();
  }

  const executionPromise = compute().finally(() => {
    inFlightYouthPipeline.delete(cacheKey);
  });

  inFlightYouthPipeline.set(cacheKey, executionPromise);
  return executionPromise;
};

function buildPlayerSummaries(
  snapshots: PersistedSnapshot[],
  latest: PersistedSnapshot,
  trainingPriority: string
): PlayerDevelopmentPlayerSummary[] {
  const latestIdentityIndex = buildIdentityIndex(latest.players);

  return latest.players
    .map((player) =>
      buildPlayerSummary(player, snapshots, latest, latestIdentityIndex, trainingPriority)
    )
    .sort((left, right) => {
      const rightNet = right.recentEvolution.improvedSkills - right.recentEvolution.declinedSkills;
      const leftNet = left.recentEvolution.improvedSkills - left.recentEvolution.declinedSkills;

      return rightNet - leftNet || left.name.localeCompare(right.name);
    });
}

function buildPlayerSummary(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[],
  latest: PersistedSnapshot,
  latestIdentityIndex: Map<number, PersistedPlayerSnapshot[]>,
  trainingPriority: string
): PlayerDevelopmentPlayerSummary {
  const role = resolveRole(player);
  const relevantSkillKeys = readRelevantSkills(role.label);
  const relevantSkills = relevantSkillKeys.map((skill) => ({ skill, value: player.skills[skill] }));
  const playerWarnings = buildPlayerWarnings(player, snapshots, latestIdentityIndex);
  const previousPoint = findPreviousComparablePlayer(player, snapshots);
  const skillChanges = skillKeys.map((skill) =>
    buildSkillChange(skill, previousPoint?.player ?? null, player)
  );
  const recentEvolution = summarizeSkillChanges(skillChanges, playerWarnings, snapshots.length);
  const findings = buildFindings({
    skillChanges,
    evolution: recentEvolution,
    current: player,
    currentSnapshot: latest,
    previousPoint,
    snapshotCount: snapshots.length,
    warnings: playerWarnings
  });
  const signals = buildSignals(skillChanges, recentEvolution, player, trainingPriority);

  return {
    playerId: player.playerId,
    name: player.name,
    age: player.age,
    role,
    relevantSkills,
    skillChanges,
    recentEvolution,
    findings,
    signals,
    warnings: playerWarnings
  };
}

function buildGlobalWarnings(snapshots: PersistedSnapshot[]): PlayerDevelopmentWarning[] {
  if (snapshots.length === 0) {
    return [
      {
        code: "no_snapshots",
        message: "El desarrollo de jugadores necesita snapshots de plantilla importados.",
        evidence: [{ kind: "observed", label: "Snapshots disponibles", value: 0 }]
      }
    ];
  }

  if (snapshots.length < 2) {
    return [
      {
        code: "few_snapshots",
        message: "Few snapshots available; ATLAS displays current data without evaluating evolution.",
        evidence: [{ kind: "observed", label: "Available snapshots", value: snapshots.length }]
      }
    ];
  }

  return [];
}

function buildPlayerWarnings(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[],
  latestIdentityIndex: Map<number, PersistedPlayerSnapshot[]>
): PlayerDevelopmentWarning[] {
  const warnings: PlayerDevelopmentWarning[] = [];
  const missingSkills = skillKeys.filter((skill) => player.skills[skill] === null);

  if (!player.playerId) {
    warnings.push({
      code: "ambiguous_identity",
      message: "Missing stable identity; history is not merged automatically.",
      evidence: [
        { kind: "observed", label: "Player", value: player.name },
        { kind: "observed", label: "Player id", value: player.playerId }
      ]
    });
  }

  if (player.playerId && (latestIdentityIndex.get(player.playerId)?.length ?? 0) > 1) {
    warnings.push({
      code: "ambiguous_identity",
      message: "Stable identity appears duplicated in the current snapshot.",
      evidence: [
        { kind: "observed", label: "Player", value: player.name },
        { kind: "observed", label: "Player id", value: player.playerId }
      ]
    });
  }

  if (snapshots.length < 2) {
    warnings.push({
      code: "insufficient_history",
      message: "Insufficient history to evaluate player evolution.",
      evidence: [{ kind: "observed", label: "Available snapshots", value: snapshots.length }]
    });
  }

  if (missingSkills.length > 0) {
    warnings.push({
      code: "missing_skills",
      message:
        "Missing visible skills; comparisons are computed using present data only.",
      evidence: [
        { kind: "observed", label: "Player", value: player.name },
        { kind: "observed", label: "Missing skills", value: missingSkills.join(", ") }
      ]
    });
  }

  return warnings;
}

function buildSkillChange(
  skill: SkillKey,
  previous: PersistedPlayerSnapshot | null,
  current: PersistedPlayerSnapshot
): PlayerSkillChange {
  const previousValue = previous?.skills[skill] ?? null;
  const currentValue = current.skills[skill];

  if (previousValue === null || currentValue === null) {
    return {
      skill,
      direction: "insufficient_data",
      previousValue,
      currentValue,
      delta: null
    };
  }

  const delta = currentValue - previousValue;

  return {
    skill,
    direction: classifyDelta(delta),
    previousValue,
    currentValue,
    delta
  };
}

function summarizeSkillChanges(
  changes: PlayerSkillChange[],
  warnings: PlayerDevelopmentWarning[],
  snapshotCount: number
): PlayerDevelopmentPlayerSummary["recentEvolution"] {
  const improvedSkills = changes.filter((change) => change.direction === "up").length;
  const declinedSkills = changes.filter((change) => change.direction === "down").length;
  const stableSkills = changes.filter((change) => change.direction === "stable").length;
  const comparableSkills = improvedSkills + declinedSkills + stableSkills;

  return {
    direction:
      comparableSkills === 0 ? "insufficient_data" : classifyDelta(improvedSkills - declinedSkills),
    improvedSkills,
    declinedSkills,
    stableSkills,
    comparableSkills,
    confidence: confidenceFromEvidence(comparableSkills, warnings, snapshotCount)
  };
}

function buildFindings(input: {
  skillChanges: PlayerSkillChange[];
  evolution: PlayerDevelopmentPlayerSummary["recentEvolution"];
  current: PersistedPlayerSnapshot;
  currentSnapshot: PersistedSnapshot;
  previousPoint: ComparablePlayerPoint | null;
  snapshotCount: number;
  warnings: PlayerDevelopmentWarning[];
}): PlayerDevelopmentFinding[] {
  const comparableChanges = input.skillChanges.filter((change) => change.delta !== null);
  const changedSkills = comparableChanges.filter((change) => change.delta !== 0);
  const improvedSkills = comparableChanges.filter((change) => (change.delta ?? 0) > 0);
  const declinedSkills = comparableChanges.filter((change) => (change.delta ?? 0) < 0);
  const baseEvidence = buildFindingEvidence(
    input.current,
    input.currentSnapshot,
    input.previousPoint,
    input.snapshotCount
  );

  if (!input.previousPoint || input.evolution.comparableSkills < 4) {
    return [
      {
        type: "insufficient_data",
        severity: "info",
        confidence: "low",
        title: "Insufficient data",
        description:
          "There are not two comparable snapshots with sufficient skills to classify evolution.",
        evidence: [
          ...baseEvidence,
          {
            kind: "derived",
            label: "Comparable skills",
            value: input.evolution.comparableSkills
          },
          {
            kind: "inferred",
            label: "Conclusion",
            value: "Insufficient"
          }
        ]
      }
    ];
  }

  if (declinedSkills.length > improvedSkills.length) {
    return [
      {
        type: "decline",
        severity: severityFromNetDelta(totalDelta(declinedSkills), "decline"),
        confidence: input.evolution.confidence,
        title: "Observed decline",
        description:
          "The latest snapshot shows more visible skills declining than improving. This is an observed reading, not a training cause.",
        evidence: [
          ...baseEvidence,
          ...skillEvidence(declinedSkills),
          { kind: "derived", label: "Net skill delta", value: totalDelta(changedSkills) },
          { kind: "inferred", label: "Training causality", value: "Not attributed" }
        ]
      }
    ];
  }

  if (improvedSkills.length > declinedSkills.length) {
    return [
      {
        type: "improvement",
        severity: severityFromNetDelta(totalDelta(improvedSkills), "improvement"),
        confidence: input.evolution.confidence,
        title: "Observed improvement",
        description:
          "The latest snapshot shows more visible skills improving than declining. ATLAS does not attribute causality to training.",
        evidence: [
          ...baseEvidence,
          ...skillEvidence(improvedSkills),
          { kind: "derived", label: "Net skill delta", value: totalDelta(changedSkills) },
          { kind: "inferred", label: "Training causality", value: "Not attributed" }
        ]
      }
    ];
  }

  if (input.current.age >= 24) {
    return [];
  }

  let stagnationSeverity: Severity;
  if (input.current.training.advanced) {
    stagnationSeverity = "high";
  } else {
    stagnationSeverity = input.snapshotCount >= 3 ? "medium" : "low";
  }

  return [
    {
      type: "stagnation",
      severity: stagnationSeverity,
      confidence: input.evolution.confidence,
      title: "Observed stagnation",
      description:
        "Comparable visible skills show no net progress over the analyzed window.",
      evidence: [
        ...baseEvidence,
        { kind: "derived", label: "Stable skills", value: input.evolution.stableSkills },
        { kind: "derived", label: "Net skill delta", value: totalDelta(changedSkills) },
        { kind: "inferred", label: "Conclusion", value: "Observed stagnation" }
      ]
    }
  ];
}

function buildSignals(
  changes: PlayerSkillChange[],
  evolution: PlayerDevelopmentPlayerSummary["recentEvolution"],
  player: PersistedPlayerSnapshot,
  trainingPriority: string
): PlayerDevelopmentSignal[] {
  const signals: PlayerDevelopmentSignal[] = [];

  if (evolution.comparableSkills === 0) {
    signals.push({
      code: "needs_more_history",
      confidence: "low",
      message: "Without two comparable points, prudent evolution reading is unavailable.",
      evidence: [{ kind: "derived", label: "Comparable skills", value: 0 }]
    });
    return signals;
  }

  if (evolution.improvedSkills > evolution.declinedSkills) {
    signals.push({
      code: "observed_skill_growth",
      confidence: evolution.confidence,
      message: "Observed improvement in more skills than declines.",
      evidence: [
        { kind: "observed", label: "Player", value: player.name },
        { kind: "derived", label: "Skills improved", value: evolution.improvedSkills },
        { kind: "derived", label: "Skills declined", value: evolution.declinedSkills }
      ]
    });
  }

  if (evolution.declinedSkills > 0) {
    signals.push({
      code: "observed_skill_decline",
      confidence: evolution.confidence,
      message: "Observed decline in at least one visible skill.",
      evidence: [
        { kind: "derived", label: "Skills declined", value: evolution.declinedSkills }
      ]
    });
  }

  signals.push({
    code: "training_priority_context",
    confidence: "low",
    message: "Training priority is displayed as manual club context only.",
    evidence: [
      { kind: "manual", label: "training.priority", value: trainingPriority },
      { kind: "inferred", label: "Attributed causality", value: "No" }
    ]
  });

  return signals;
}

function findPreviousComparablePlayer(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[]
): ComparablePlayerPoint | null {
  const latestSnapshot = snapshots.at(-1);

  if (!player.playerId || snapshots.length < 2 || !latestSnapshot) {
    return null;
  }

  const latestDate = latestSnapshot.snapshotDate.getTime();
  const targetTimeDiff = 21 * 24 * 60 * 60 * 1000; // 21 days in milliseconds

  const previousSnapshots = snapshots.slice(0, -1).reverse();
  let bestMatch: ComparablePlayerPoint | null = null;

  for (const snapshot of previousSnapshots) {
    const matches = snapshot.players.filter(
      (candidate) => candidate.playerId === player.playerId
    );

    if (matches.length === 1) {
      const point = {
        snapshotId: snapshot.id,
        snapshotDate: formatDate(snapshot.snapshotDate),
        player: matches[0]!
      };

      const timeDiff = latestDate - snapshot.snapshotDate.getTime();
      if (timeDiff >= targetTimeDiff) {
        return point;
      }

      bestMatch = point;
    }
  }

  return bestMatch;
}

function buildIdentityIndex(
  players: PersistedPlayerSnapshot[]
): Map<number, PersistedPlayerSnapshot[]> {
  const index = new Map<number, PersistedPlayerSnapshot[]>();

  for (const player of players) {
    if (player.playerId) {
      index.set(player.playerId, [...(index.get(player.playerId) ?? []), player]);
    }
  }

  return index;
}

function mapObservedPlayer(player: PersistedPlayerSnapshot): PlayerDevelopmentObservedPlayer {
  return {
    playerId: player.playerId,
    snapshotPlayerId: player.id,
    name: player.name,
    age: player.age,
    observedPosition: player.observedPosition,

    skills: player.skills
  };
}

function resolveRole(player: PersistedPlayerSnapshot): PlayerDevelopmentPlayerSummary["role"] {
  if (player.observedPosition) {
    return { label: player.observedPosition, source: "observed" };
  }

  return { label: "Undefined", source: "unknown" };
}

function readRelevantSkills(roleLabel: string): SkillKey[] {
  return roleRelevantSkills[roleLabel.toLowerCase()] ?? roleRelevantSkills.undefined ?? [];
}

function confidenceFromEvidence(
  comparableSkills: number,
  warnings: PlayerDevelopmentWarning[],
  snapshotCount: number
): Confidence {
  if (comparableSkills < 4 || warnings.some((warning) => warning.code === "ambiguous_identity")) {
    return "low";
  }

  if (warnings.length > 0 || snapshotCount < 3) {
    return "medium";
  }

  return "high";
}

function buildFindingEvidence(
  current: PersistedPlayerSnapshot,
  currentSnapshot: PersistedSnapshot,
  previousPoint: ComparablePlayerPoint | null,
  snapshotCount: number
): DevelopmentEvidence[] {
  return [
    { kind: "observed", label: "Jugador", value: current.name },
    { kind: "observed", label: "Snapshots disponibles", value: snapshotCount },
    { kind: "observed", label: "Snapshot anterior", value: previousPoint?.snapshotId ?? null },
    { kind: "observed", label: "Fecha anterior", value: previousPoint?.snapshotDate ?? null },
    { kind: "observed", label: "Snapshot actual", value: currentSnapshot.id },
    { kind: "observed", label: "Fecha actual", value: formatDate(currentSnapshot.snapshotDate) },
    {
      kind: "observed",
      label: "Ventana temporal",
      value: buildWindowLabel(previousPoint, currentSnapshot)
    }
  ];
}

function skillEvidence(changes: PlayerSkillChange[]): DevelopmentEvidence[] {
  return changes.map((change) => ({
    kind: "observed",
    label: change.skill,
    value: `${change.previousValue} -> ${change.currentValue} (${formatSignedDelta(change.delta ?? 0)})`
  }));
}

function totalDelta(changes: PlayerSkillChange[]): number {
  return changes.reduce((total, change) => total + (change.delta ?? 0), 0);
}

function severityFromNetDelta(delta: number, type: "improvement" | "decline"): Severity {
  const magnitude = Math.abs(delta);

  if (type === "improvement") {
    return magnitude >= 4 ? "medium" : "low";
  }

  if (magnitude >= 4) return "high";
  if (magnitude >= 2) return "medium";
  return "low";
}

function buildWindowLabel(
  previousPoint: ComparablePlayerPoint | null,
  currentSnapshot: PersistedSnapshot
): string | null {
  if (!previousPoint) {
    return null;
  }

  return `${previousPoint.snapshotDate} -> ${formatDate(currentSnapshot.snapshotDate)}`;
}

function formatSignedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : delta.toString();
}

function classifyDelta(delta: number): DeltaDirection {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "stable";
}



function buildEmptyPlanning(clubId: ClubId, academyInvestment: string): YouthPipelinePlanning {
  return {
    clubId,
    snapshotId: null,
    snapshotDate: null,
    observed: {
      youthAgeThreshold: YOUTH_PIPELINE_AGE_THRESHOLD,
      players: [],
      coverage: {
        seniorPlayerCount: 0,
        youngSeniorPlayerCount: 0,
        playersWithStableIdentity: 0,
        playersWithCompleteSkills: 0
      }
    },
    manual: { academyInvestment },
    derived: {
      categoryCounts: {
        standout_prospect: 0,
        follow_up: 0,
        stagnation_risk: 0,
        insufficient_data: 0
      },
      players: []
    },
    warnings: [
      {
        code: "no_snapshots",
        message: "El pipeline juvenil senior necesita un snapshot de plantilla.",
        evidence: [{ kind: "observed", label: "Snapshots disponibles", value: 0 }]
      }
    ]
  };
}

function buildDevelopmentIndex(
  players: PlayerDevelopmentPlayerSummary[]
): Map<string, PlayerDevelopmentPlayerSummary> {
  const index = new Map<string, PlayerDevelopmentPlayerSummary>();

  for (const player of players) {
    if (player.playerId) index.set(`player:${player.playerId}`, player);
  }

  return index;
}

function buildMarketIndex(players: SquadMarketPlayerPlan[]): Map<string, SquadMarketPlayerPlan> {
  return new Map(players.map((player) => [player.snapshotPlayerId, player]));
}

function buildPlayerPlan(input: {
  player: PersistedPlayerSnapshot;
  snapshots: PersistedSnapshot[];
  academyInvestment: string;
  currency: string;
  developmentSummary: PlayerDevelopmentPlayerSummary | null;
  marketPlan: SquadMarketPlayerPlan | null;
}): YouthPipelinePlayerPlan {
  const context = buildPlayerContext(input.player, input.snapshots, input.developmentSummary, input.currency);
  const warnings = buildYouthWarnings(
    input.player,
    input.snapshots,
    input.developmentSummary,
    context
  );
  const signals = buildYouthSignals({ ...input, context });
  const category = chooseCategory(signals, warnings);
  const strongestSignal = signals[0] ?? null;

  return {
    playerId: input.player.playerId,
    snapshotPlayerId: input.player.id,
    name: input.player.name,
    age: input.player.age,
    role: resolveRole(input.player),
    category,
    severity: strongestSignal?.severity ?? "info",
    confidence: calculateConfidence(signals, warnings),
    rationale: buildRationale(category),
    context,
    signals: signals.length > 0 ? signals : [buildInsufficientSignal(input.player)],
    warnings
  };
}

function buildPlayerContext(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[],
  developmentSummary: PlayerDevelopmentPlayerSummary | null,
  currency: string
): YouthPipelinePlayerContext {
  const history = findPlayerHistory(player, snapshots);
  const first = history[0] ?? null;
  const latest = history.at(-1) ?? null;
  const limits: string[] = [
    "Young senior players observed in senior squad only.",
    "Does not use real Sokker youth academy data."
  ];

  if (history.length < 2) limits.push("Short history for individual evolution.");
  if (!hasCompleteSkills(player)) limits.push("Incomplete visible skills.");
  if (player.wage <= 0 || player.value <= 0) {
    limits.push("Missing value or wage limits asset evaluation.");
  }

  return {
    window: {
      from: first ? formatDate(first.snapshot.snapshotDate) : undefined,
      to: latest ? formatDate(latest.snapshot.snapshotDate) : undefined,
      snapshotCount: history.length
    },
    dataCompleteness: {
      completeSkills: hasCompleteSkills(player),
      comparableSkills: developmentSummary?.recentEvolution.comparableSkills ?? 0
    },
    valueAndWage: {
      wage: player.wage,
      wageCurrency: currency,
      value: player.value,
      valueCurrency: currency,
      valueDeltaPercent:
        first && latest
          ? (calculatePercentDelta(
              first.player.value,
              latest.player.value
            ) ?? undefined)
          : undefined,
      wageDeltaPercent:
        first && latest
          ? (calculatePercentDelta(first.player.wage, latest.player.wage) ??
            undefined)
          : undefined
    },
    limits
  };
}

function findPlayerHistory(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[]
): Array<{ snapshot: PersistedSnapshot; player: PersistedPlayerSnapshot }> {
  return snapshots
    .map((snapshot) => {
      const matchingPlayer = snapshot.players.find((candidate) => {
        if (player.playerId && candidate.playerId) return candidate.playerId === player.playerId;
        return false;
      });

      return matchingPlayer ? { snapshot, player: matchingPlayer } : null;
    })
    .filter((entry): entry is { snapshot: PersistedSnapshot; player: PersistedPlayerSnapshot } =>
      Boolean(entry)
    );
}

function hasCompleteSkills(player: PersistedPlayerSnapshot): boolean {
  return skillKeys.every((skill) => player.skills[skill] !== null);
}

function calculatePercentDelta(previous: number, current: number): number | null {
  if (previous <= 0) {
    return null;
  }

  return Number(((current - previous) / previous).toFixed(4));
}

function buildYouthWarnings(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[],
  developmentSummary: PlayerDevelopmentPlayerSummary | null,
  context: YouthPipelinePlayerContext
): YouthPipelineWarning[] {
  const warnings: YouthPipelineWarning[] = [];
  const missingSkills = skillKeys.filter((skill) => player.skills[skill] === null);

  if (!player.playerId) {
    warnings.push({
      code: "ambiguous_identity",
      message: "Falta identidad estable; el historial del joven puede no ser comparable.",
      evidence: [{ kind: "observed", label: "Player id", value: player.playerId ?? undefined }]
    });
  }

  if (snapshots.length < 2) {
    warnings.push({
      code: "short_history",
      message: "Historial corto; la lectura no debe convertirse en conclusion fuerte.",
      evidence: [{ kind: "observed", label: "Snapshots disponibles", value: snapshots.length }]
    });
  }

  if (!developmentSummary || developmentSummary.recentEvolution.comparableSkills === 0) {
    warnings.push({
      code: "short_player_history",
      message: "The player does not have two comparable development points.",
      evidence: [{ kind: "derived", label: "Comparable skills", value: 0 }]
    });
  }

  if (missingSkills.length > 0) {
    warnings.push({
      code: "missing_skills",
      message: "Missing visible skills; classification is limited.",
      evidence: [
        { kind: "observed", label: "Missing skills", value: missingSkills.join(", ") }
      ]
    });
  }

  if (
    developmentSummary &&
    developmentSummary.recentEvolution.improvedSkills > 0 &&
    developmentSummary.recentEvolution.declinedSkills > 0
  ) {
    warnings.push({
      code: "contradictory_signals",
      message:
        "Mixed signals of improvement and decline; follow-up is required before strong classification.",
      evidence: [
        {
          kind: "derived",
          label: "Skills improved",
          value: developmentSummary.recentEvolution.improvedSkills
        },
        {
          kind: "derived",
          label: "Skills declined",
          value: developmentSummary.recentEvolution.declinedSkills
        }
      ]
    });
  }

  if (player.age === null || !Number.isFinite(player.age)) {
    warnings.push({
      code: "missing_age",
      message: "Missing comparable age; youth evaluation cannot be strong.",
      evidence: [{ kind: "observed", label: "Age", value: player.age }]
    });
  }

  if (context.valueAndWage.wage <= 0 || context.valueAndWage.value <= 0) {
    warnings.push({
      code: "missing_value_or_wage",
      message: "Falta salario o valor estimado positivo; el contexto patrimonial queda limitado.",
      evidence: [
        { kind: "observed", label: "Salario", value: context.valueAndWage.wage },
        { kind: "observed", label: "Valor estimado", value: context.valueAndWage.value }
      ]
    });
  }

  return warnings;
}

function buildYouthSignals(input: {
  player: PersistedPlayerSnapshot;
  academyInvestment: string;
  currency: string;
  developmentSummary: PlayerDevelopmentPlayerSummary | null;
  marketPlan: SquadMarketPlayerPlan | null;
  context: YouthPipelinePlayerContext;
}): YouthPipelineSignal[] {
  const signals: YouthPipelineSignal[] = [];
  const development = input.developmentSummary;
  const improvedSkills = development?.recentEvolution.improvedSkills ?? 0;
  const declinedSkills = development?.recentEvolution.declinedSkills ?? 0;
  const comparableSkills = development?.recentEvolution.comparableSkills ?? 0;
  const relevantSkillAverage = averageSkills(development?.relevantSkills ?? []);

  if (
    input.player.age <= 21 &&
    relevantSkillAverage !== null &&
    relevantSkillAverage >= 9 &&
    improvedSkills > declinedSkills
  ) {
    signals.push({
      code: "standout_young_growth",
      severity: input.context.window.snapshotCount >= 3 ? "medium" : "low",
      confidence:
        input.context.window.snapshotCount >= 3
          ? (development?.recentEvolution.confidence ?? "medium")
          : "medium",
      message:
        "Young senior squad player with high relevant skills and observed improvement.",
      evidence: [
        { kind: "observed", label: "Age", value: input.player.age },
        { kind: "observed", label: "Role", value: resolveRole(input.player).label },
        { kind: "observed", label: "Window from", value: input.context.window.from },
        { kind: "observed", label: "Window to", value: input.context.window.to },
        { kind: "derived", label: "Relevant skill average", value: relevantSkillAverage },
        { kind: "derived", label: "Skills improved", value: improvedSkills },
        {
          kind: "derived",
          label: "Value variation %",
          value: input.context.valueAndWage.valueDeltaPercent
        },
        { kind: "observed", label: "Wage", value: input.player.wage },
        { kind: "observed", label: "Estimated value", value: input.player.value },
        { kind: "manual", label: "academy.investment", value: input.academyInvestment }
      ]
    });
  }

  if (input.marketPlan?.category === "protection_candidate") {
    signals.push({
      code: "market_protection_context",
      severity: "medium",
      confidence: input.marketPlan.confidence,
      message:
        "Internal market planning also marks the player as an asset to protect.",
      evidence: [
        { kind: "inferred", label: "Internal market signal", value: input.marketPlan.category },
        { kind: "inferred", label: "Market timing", value: input.marketPlan.timing.label },
        { kind: "observed", label: "Window from", value: input.context.window.from },
        { kind: "observed", label: "Window to", value: input.context.window.to }
      ]
    });
  }

  if (development?.findings.some((finding) => finding.type === "stagnation")) {
    signals.push({
      code: "young_stagnation_risk",
      severity: input.player.age >= 22 ? "medium" : "low",
      confidence: development.recentEvolution.confidence,
      message:
        "The development module shows observed stagnation; follow-up priority should be reviewed.",
      evidence: [
        { kind: "observed", label: "Age", value: input.player.age },
        { kind: "observed", label: "Role", value: resolveRole(input.player).label },
        { kind: "observed", label: "Window from", value: input.context.window.from },
        { kind: "observed", label: "Window to", value: input.context.window.to },
        { kind: "derived", label: "Comparable skills", value: comparableSkills },
        {
          kind: "derived",
          label: "Value variation %",
          value: input.context.valueAndWage.valueDeltaPercent
        },
        {
          kind: "derived",
          label: "Wage variation %",
          value: input.context.valueAndWage.wageDeltaPercent
        },
        { kind: "inferred", label: "Development finding", value: "stagnation" }
      ]
    });
  }

  if (declinedSkills > improvedSkills) {
    signals.push({
      code: "young_decline_review",
      severity: "medium",
      confidence: development?.recentEvolution.confidence ?? "low",
      message: "More visible skills declining than improving for a young player.",
      evidence: [
        { kind: "observed", label: "Window from", value: input.context.window.from },
        { kind: "observed", label: "Window to", value: input.context.window.to },
        { kind: "derived", label: "Skills declined", value: declinedSkills },
        { kind: "derived", label: "Skills improved", value: improvedSkills },
        {
          kind: "derived",
          label: "Value variation %",
          value: input.context.valueAndWage.valueDeltaPercent
        }
      ]
    });
  }

  if (input.player.age <= YOUTH_PIPELINE_AGE_THRESHOLD && comparableSkills === 0) {
    signals.push({
      code: "young_senior_follow_up",
      severity: "low",
      confidence: "low",
      message:
        "Young senior squad player without sufficient comparable history; prudent follow-up required.",
      evidence: [
        { kind: "observed", label: "Age", value: input.player.age },
        { kind: "observed", label: "Role", value: resolveRole(input.player).label },
        { kind: "derived", label: "Comparable skills", value: comparableSkills },
        {
          kind: "observed",
          label: "Comparable snapshots",
          value: input.context.window.snapshotCount
        },
        { kind: "manual", label: "academy.investment", value: input.academyInvestment }
      ]
    });
  }

  return signals.sort(compareSignals);
}

function averageSkills(skills: Array<{ value: number | null }>): number | null {
  const values = skills
    .map((skill) => skill.value)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function compareSignals(left: YouthPipelineSignal, right: YouthPipelineSignal): number {
  return severityPriority(right.severity) - severityPriority(left.severity);
}

function severityPriority(severity: Severity): number {
  if (severity === "high") return 4;
  if (severity === "medium") return 3;
  if (severity === "low") return 2;
  return 1;
}

function calculateConfidence(
  signals: YouthPipelineSignal[],
  warnings: YouthPipelineWarning[]
): Confidence {
  if (
    signals.length === 0 ||
    warnings.some((warning) =>
      [
        "missing_skills",
        "ambiguous_identity",
        "short_player_history",
        "contradictory_signals",
        "missing_age"
      ].includes(warning.code)
    )
  ) {
    return "low";
  }

  if (signals.some((signal) => signal.confidence === "high") && warnings.length === 0) {
    return "high";
  }

  return "medium";
}

function buildRationale(category: Category): string {
  if (category === "standout_prospect") {
    return "Standout prospect within senior squad; does not imply real youth academy.";
  }

  if (category === "stagnation_risk") {
    return "Stagnation or decline risk observed, requiring prudent follow-up.";
  }

  if (category === "follow_up") {
    return "Young senior player to monitor before drawing strong conclusions.";
  }

  return "Insufficient data to strongly classify.";
}

function buildInsufficientSignal(player: PersistedPlayerSnapshot): YouthPipelineSignal {
  return {
    code: "insufficient_youth_signal",
    severity: "info",
    confidence: "low",
    message: "Insufficient evidence to strongly classify the young senior player.",
    evidence: [{ kind: "observed", label: "Player", value: player.name }]
  };
}

function chooseCategory(
  signals: YouthPipelineSignal[],
  warnings: YouthPipelineWarning[]
): Category {
  if (warnings.some((warning) => warning.code === "contradictory_signals")) {
    return "follow_up";
  }

  if (
    warnings.some((warning) =>
      ["missing_skills", "ambiguous_identity", "short_player_history"].includes(warning.code)
    ) &&
    !signals.some((signal) => signal.code === "young_stagnation_risk")
  ) {
    return "insufficient_data";
  }

  if (
    signals.some((signal) =>
      ["standout_young_growth", "market_protection_context"].includes(signal.code)
    )
  ) {
    return "standout_prospect";
  }

  if (
    signals.some((signal) =>
      ["young_stagnation_risk", "young_decline_review"].includes(signal.code)
    )
  ) {
    return "stagnation_risk";
  }

  if (signals.some((signal) => signal.code === "young_senior_follow_up")) {
    return "follow_up";
  }

  return "insufficient_data";
}

function findDevelopmentSummary(
  player: PersistedPlayerSnapshot,
  index: Map<string, PlayerDevelopmentPlayerSummary>
): PlayerDevelopmentPlayerSummary | null {
  if (player.playerId) return index.get(`player:${player.playerId}`) ?? null;
  return null;
}

function comparePlayerPlans(left: YouthPipelinePlayerPlan, right: YouthPipelinePlayerPlan): number {
  return (
    categoryPriority(right.category) - categoryPriority(left.category) ||
    severityPriority(right.severity) - severityPriority(left.severity) ||
    left.name.localeCompare(right.name)
  );
}

function categoryPriority(category: Category): number {
  if (category === "stagnation_risk") return 4;
  if (category === "standout_prospect") return 3;
  if (category === "follow_up") return 2;
  return 1;
}

function mapObservedYouth(player: PersistedPlayerSnapshot, currency: string): YouthPipelineObservedPlayer {
  return {
    playerId: player.playerId,
    snapshotPlayerId: player.id,
    name: player.name,
    age: player.age,
    role: resolveRole(player),
    wage: { amount: player.wage, currency },
    value: { amount: player.value, currency },
    skills: player.skills
  };
}

function countCategories(players: YouthPipelinePlayerPlan[]): Record<Category, number> {
  return {
    standout_prospect: players.filter((player) => player.category === "standout_prospect").length,
    follow_up: players.filter((player) => player.category === "follow_up").length,
    stagnation_risk: players.filter((player) => player.category === "stagnation_risk").length,
    insufficient_data: players.filter((player) => player.category === "insufficient_data").length
  };
}

function buildGlobalYouthWarnings(
  latest: PersistedSnapshot,
  snapshots: PersistedSnapshot[],
  youngPlayers: PersistedPlayerSnapshot[]
): YouthPipelineWarning[] {
  const warnings: YouthPipelineWarning[] = [
    {
      code: "senior_youth_scope",
      message:
        "Esta vista analiza jovenes del plantel senior; no representa escuela juvenil real de Sokker.",
      evidence: [
        { kind: "observed", label: "Jugadores senior", value: latest.players.length },
        { kind: "derived", label: "Umbral joven", value: YOUTH_PIPELINE_AGE_THRESHOLD }
      ]
    }
  ];

  if (youngPlayers.length === 0) {
    warnings.push({
      code: "no_young_senior_players",
      message: "No senior squad players within the defined youth threshold.",
      evidence: [{ kind: "derived", label: "Young seniors", value: 0 }]
    });
  }

  if (snapshots.length < 2) {
    warnings.push({
      code: "short_history",
      message: "Young senior pipeline reading improves with at least two snapshots.",
      evidence: [{ kind: "observed", label: "Available snapshots", value: snapshots.length }]
    });
  }

  return warnings;
}

export * from './types.js'


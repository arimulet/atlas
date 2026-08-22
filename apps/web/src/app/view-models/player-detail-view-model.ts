import { formatTrainingPriority } from "../formatters";
import {
  calculateRequiredTrainingPoints,
  calculateWeeklyTrainingPointsByKind,
  type DevelopmentPlayer
} from "@atlas/domain";
import type {
  DashboardStatus,
  DiagnosticFinding,
  PlayerDevelopment,
  SquadPlanningBundle,
  TrainingPageData
} from "@atlas/web/app/types";
import {
  diagnosticFindingsForPlayer,
  trainedSkillForPosition,
  trainingPositionCode,
  trainingStatusForPlayer,
  type TrainingDiagnostic,
  type TrainingPlayerRow
} from "./training-view-model";
import {
  createPlayerMarketValueViewModel,
  type PlayerMarketValueViewModel
} from "./market-value-view-model";

const SKILL_DEFINITIONS = [
  { key: "stamina", trainingPriority: 1 },
  { key: "keeper", trainingPriority: 2 },
  { key: "pace", trainingPriority: 8 },
  { key: "defender", trainingPriority: 6 },
  { key: "technique", trainingPriority: 5 },
  { key: "playmaker", trainingPriority: 3 },
  { key: "passing", trainingPriority: 4 },
  { key: "striker", trainingPriority: 7 }
] as const;

type SkillKey = (typeof SKILL_DEFINITIONS)[number]["key"];

export interface PlayerDetailViewModel {
  player: {
    id: string;
    name: string;
    age: number;
  };
  developmentPlayer: (DevelopmentPlayer & { age: number }) | null;
  skills: Array<{
    key: SkillKey;
    label: string;
    value: number | null;
  }>;
  training: TrainingPlayerRow & {
    position: string | null;
    trainedSkill: string | null;
  };
  talent: {
    estimated: number | null;
    confidence?: "unknown" | "low" | "medium" | "high";
    observations?: number;
    updatedAt?: string;
  };
  projection: {
    current: {
      skill: string | null;
      level: number | null;
      progress: number | null;
    };
    nextSkillUp?: {
      targetLevel: number;
      estimatedWeeks: number | null;
    };
    horizon?: {
      weeks: number;
      projectedLevel: number;
    };
  };
  diagnostics: DiagnosticFinding[];
  recentSkillUps: Array<{
    date: string | null;
    skill: string;
    fromLevel: number;
    toLevel: number;
  }>;
  trainingHistory: Array<{
    week: number;
    type: string;
    kind: "advanced" | "formation" | "missing";
    intensity: number;
    skillChanges: Array<{
      skill: string;
      before: number;
      after: number;
      direction: "up" | "down";
    }>;
  }>;
  marketValue?: PlayerMarketValueViewModel | null;
}

export interface PlayerTrainingProjectionSummary {
  playerId: string;
  progress: number | null;
  talent: number | null;
  nextSkillUp: number | null;
  etaWeeks: number | null;
}

export interface CreatePlayerDetailViewModelInput {
  playerId: string;
  training: TrainingPageData | null;
  development: PlayerDevelopment | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: DashboardStatus;
  squadPlanning?: SquadPlanningBundle | null;
  currency?: string | null;
}

export function createPlayerDetailViewModel(
  input: CreatePlayerDetailViewModelInput
): PlayerDetailViewModel | null {
  const player = input.training?.players.find(
    (candidate) =>
      identifiersMatch(candidate.playerId, input.playerId) ||
      input.development?.observed.players.some(
        (observed) =>
          identifiersMatch(observed.snapshotPlayerId, candidate.id) &&
          identifiersMatch(observed.playerId, input.playerId)
      )
  );

  if (!player) {
    return null;
  }

  const observedPlayer = input.development?.observed.players.find((candidate) =>
    identifiersMatch(candidate.snapshotPlayerId, player.id)
  );
  const trainedSkill = trainedSkillForPosition(
    input.training?.configuration ?? null,
    player.training.position
  );
  const trainingRow =
    input.trainingStatus === "ready"
      ? createTrainingRow(player, input.trainingDiagnostic)
      : createTrainingRow(player, null);
  const trainedSkillDefinition = SKILL_DEFINITIONS.find(
    (definition) => definition.trainingPriority === trainedSkill
  );
  const currentSkillLevel =
    trainedSkillDefinition === undefined
      ? null
      : (observedPlayer?.skills[trainedSkillDefinition.key] ?? null);
  const talentEstimate = player.talentEstimate ?? null;
  const trainingProjection = createTrainingProjection({
    currentSkillLevel,
    history: (input.training?.history ?? []).filter((report) =>
      identifiersMatch(report.playerId, player.playerId)
    ),
    skill: trainedSkillDefinition?.key ?? null,
    talentEstimate,
    age: player.age
  });
  const nextSkillUp = trainingProjection?.nextSkillUp;
  const marketPlayer = input.squadPlanning?.assessment.depthPlayers.find(
    (candidate) =>
      identifiersMatch(candidate.playerId, observedPlayer?.playerId) ||
      identifiersMatch(candidate.playerId, player.playerId)
  );

  return {
    player: {
      id: String(player.playerId),
      name: player.name,
      age: player.age
    },
    developmentPlayer: createDevelopmentPlayer(String(player.playerId), observedPlayer),
    skills: SKILL_DEFINITIONS.map((definition) => ({
      key: definition.key,
      label: formatTrainingPriority(definition.trainingPriority),
      value: observedPlayer?.skills[definition.key] ?? null
    })),
    training: {
      ...trainingRow,
      position: trainingPositionCode(player.training.position),
      trainedSkill: trainedSkill === null ? null : formatTrainingPriority(trainedSkill)
    },
    talent: {
      estimated: talentEstimate?.value ?? null,
      confidence: talentEstimate?.confidence,
      observations: talentEstimate?.evidenceCount
    },
    projection: {
      current: {
        skill: trainedSkill === null ? null : formatTrainingPriority(trainedSkill),
        level: currentSkillLevel,
        progress: trainingProjection?.progress ?? trainingRow.progress
      },
      nextSkillUp
    },
    diagnostics: diagnosticFindingsForPlayer(input.trainingDiagnostic, player),
    recentSkillUps: createRecentSkillUps(input.training, observedPlayer?.playerId ?? null),
    trainingHistory: createTrainingHistoryRows(input.training, observedPlayer?.playerId ?? null),
    marketValue: marketPlayer
      ? createPlayerMarketValueViewModel(marketPlayer, input.currency ?? null)
      : null
  };
}

function createDevelopmentPlayer(
  playerId: string,
  observedPlayer: PlayerDevelopment["observed"]["players"][number] | undefined
): (DevelopmentPlayer & { age: number }) | null {
  const stablePlayerId = observedPlayer?.playerId ?? playerId;
  const numericPlayerId = Number(stablePlayerId);

  if (!Number.isInteger(numericPlayerId) || numericPlayerId <= 0 || observedPlayer === undefined) {
    return null;
  }

  return {
    playerId: numericPlayerId,
    age: observedPlayer.age,
    observedPosition: toObservedPosition(observedPlayer.observedPosition),
    skills: observedPlayer.skills
  };
}

function toObservedPosition(value: string | null): DevelopmentPlayer["observedPosition"] {
  return value === "goalkeeper" ||
    value === "defender" ||
    value === "midfielder" ||
    value === "winger" ||
    value === "striker"
    ? value
    : null;
}

export function createPlayerTrainingProjectionSummaries(
  input: Omit<CreatePlayerDetailViewModelInput, "playerId">
): ReadonlyMap<string, PlayerTrainingProjectionSummary> {
  const summaries = new Map<string, PlayerTrainingProjectionSummary>();

  for (const player of input.training?.players ?? []) {
    const playerId = String(player.playerId);
    const viewModel = createPlayerDetailViewModel({ ...input, playerId });

    if (!viewModel) {
      continue;
    }

    summaries.set(playerId, {
      playerId,
      progress: viewModel.projection.current.progress,
      talent: viewModel.talent.estimated,
      nextSkillUp: viewModel.projection.nextSkillUp?.targetLevel ?? null,
      etaWeeks: viewModel.projection.nextSkillUp?.estimatedWeeks ?? null
    });
  }

  return summaries;
}

function createRecentSkillUps(
  training: TrainingPageData | null,
  playerId: string | null
): PlayerDetailViewModel["recentSkillUps"] {
  return (training?.history ?? [])
    .filter((report) => identifiersMatch(report.playerId, playerId))
    .flatMap((report) =>
      (report.skillChanges ?? [])
        .filter((change) => change.direction === "up")
        .map((change) => ({
          date: report.date?.toString() ?? null,
          skill: skillLabelForKey(change.skill),
          fromLevel: change.before,
          toLevel: change.after
        }))
    )
    .slice(-10)
    .reverse();
}

function createTrainingHistoryRows(
  training: TrainingPageData | null,
  playerId: string | null
): PlayerDetailViewModel["trainingHistory"] {
  return (training?.history ?? [])
    .filter((report) => identifiersMatch(report.playerId, playerId))
    .sort((left, right) => right.gameWeek - left.gameWeek)
    .map((report) => ({
      week: report.gameWeek,
      type: report.type,
      kind: report.kind,
      intensity: report.intensity,
      skillChanges: (report.skillChanges ?? []).map((change) => ({
        skill: skillLabelForKey(change.skill),
        before: change.before,
        after: change.after,
        direction: change.direction
      }))
    }));
}

function skillLabelForKey(skill: string): string {
  const definition = SKILL_DEFINITIONS.find((candidate) => candidate.key === skill);
  return definition === undefined ? skill : formatTrainingPriority(definition.trainingPriority);
}

function createTrainingProjection(input: {
  age: number;
  currentSkillLevel: number | null;
  history: NonNullable<TrainingPageData["history"]>;
  skill: SkillKey | null;
  talentEstimate: TrainingPageData["players"][number]["talentEstimate"];
}): {
  progress: number;
  nextSkillUp: { targetLevel: number; estimatedWeeks: number | null };
} | null {
  if (
    input.currentSkillLevel === null ||
    input.currentSkillLevel >= 18 ||
    input.talentEstimate?.value === null ||
    input.talentEstimate?.value === undefined ||
    input.skill === null
  ) {
    return null;
  }

  const trainingSkill = toTrainingCostSkill(input.skill);
  const history = [...input.history].sort((left, right) => left.gameWeek - right.gameWeek);
  const lastSkillUp = [...history]
    .reverse()
    .find((report) =>
      report.skillChanges?.some(
        (change) => trainingSkillForReport(change.skill) === trainingSkill && change.delta > 0
      )
    );
  if (!lastSkillUp) return null;

  const effectiveWeeks = history
    .filter(
      (report) =>
        report.gameWeek > lastSkillUp.gameWeek &&
        trainingSkillForReport(report.type) === trainingSkill
    )
    .filter((report) => report.kind !== "missing")
    .map((report) => {
      if (report.kind === "missing") return 0;

      return calculateWeeklyTrainingPointsByKind({
        intensity: report.intensity,
        kind: report.kind
      });
    });
  const accumulatedPoints = effectiveWeeks.reduce((total, points) => total + points, 0);
  const requiredPoints = calculateRequiredTrainingPoints({
    talent: input.talentEstimate.value,
    age: input.age,
    skill: trainingSkill,
    targetSkillLevel: input.currentSkillLevel + 1
  }).requiredTrainingPoints;
  const remainingPoints = Math.max(0, requiredPoints - accumulatedPoints);
  const averageWeeklyPoints =
    effectiveWeeks.length === 0 ? null : accumulatedPoints / effectiveWeeks.length;

  return {
    progress: Math.min(100, Math.max(0, (accumulatedPoints / requiredPoints) * 100)),
    nextSkillUp: {
      targetLevel: input.currentSkillLevel + 1,
      estimatedWeeks:
        averageWeeklyPoints && averageWeeklyPoints > 0
          ? remainingPoints / averageWeeklyPoints
          : null
    }
  };
}

function trainingSkillForReport(skill: string): ReturnType<typeof toTrainingCostSkill> {
  if (skill === "defender") return "defending";
  if (skill === "playmaker") return "playmaking";
  if (skill === "striker") return "scoring";
  return skill as ReturnType<typeof toTrainingCostSkill>;
}

function toTrainingCostSkill(
  skill: SkillKey
):
  "stamina" | "keeper" | "pace" | "scoring" | "defending" | "technique" | "playmaking" | "passing" {
  if (skill === "defender") {
    return "defending";
  }

  if (skill === "playmaker") {
    return "playmaking";
  }

  if (skill === "striker") {
    return "scoring";
  }

  return skill;
}

function createTrainingRow(
  player: TrainingPageData["players"][number],
  diagnostic: TrainingDiagnostic | null
): TrainingPlayerRow {
  return {
    playerId: String(player.playerId),
    playerName: player.name,
    trainingPosition: player.training.position,
    age: player.age,
    trainingType: player.latestReport?.type ?? null,
    trainingKind: player.latestReport?.kind ?? null,
    intensity: player.latestReport?.intensity ?? null,
    skillChanges: [],
    progress: null,
    talent: null,
    nextSkillUp: null,
    etaWeeks: null,
    status: trainingStatusForPlayer(player, diagnostic)
  };
}

function identifiersMatch(
  left: string | number | null | undefined,
  right: string | number | null | undefined
): boolean {
  return left !== null && left !== undefined && right !== null && right !== undefined
    ? String(left) === String(right)
    : false;
}

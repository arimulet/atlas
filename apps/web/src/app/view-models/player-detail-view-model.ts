import { formatTrainingPriority } from "../formatters";
import { calculateRequiredTrainingPoints, type DevelopmentPlayer } from "@atlas/domain";
import type {
  DashboardStatus,
  DiagnosticFinding,
  PlayerDevelopment,
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
}

export function createPlayerDetailViewModel(
  input: CreatePlayerDetailViewModelInput
): PlayerDetailViewModel | null {
  const player = input.training?.players.find(
    (candidate) =>
      identifiersMatch(candidate.id, input.playerId) ||
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
  const nextSkillUp = createProjectionNextSkillUp({
    currentSkillLevel,
    skill: trainedSkillDefinition?.key ?? null,
    talentEstimate,
    latestReport: player.latestReport ?? null,
    age: player.age
  });

  return {
    player: {
      id: player.id,
      name: player.name,
      age: player.age
    },
    developmentPlayer: createDevelopmentPlayer(player.id, observedPlayer),
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
        progress: trainingRow.progress
      },
      nextSkillUp
    },
    diagnostics: diagnosticFindingsForPlayer(input.trainingDiagnostic, player),
    recentSkillUps: createRecentSkillUps(input.training, observedPlayer?.playerId ?? null),
    trainingHistory: createTrainingHistoryRows(input.training, observedPlayer?.playerId ?? null)
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
    const viewModel = createPlayerDetailViewModel({ ...input, playerId: player.id });

    if (!viewModel) {
      continue;
    }

    summaries.set(player.id, {
      playerId: player.id,
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

function createProjectionNextSkillUp(input: {
  currentSkillLevel: number | null;
  skill: SkillKey | null;
  talentEstimate: TrainingPageData["players"][number]["talentEstimate"];
  latestReport: NonNullable<TrainingPageData["history"]>[number] | null;
  age: number;
}): PlayerDetailViewModel["projection"]["nextSkillUp"] {
  if (
    input.currentSkillLevel === null ||
    input.currentSkillLevel >= 18 ||
    input.talentEstimate?.value === null ||
    input.talentEstimate?.value === undefined ||
    input.talentEstimate.confidence === "unknown" ||
    input.talentEstimate.confidence === "low" ||
    input.latestReport?.kind !== "advanced" ||
    input.latestReport.intensity <= 0 ||
    input.skill === null
  ) {
    return undefined;
  }

  const trainingSkill = toTrainingCostSkill(input.skill);
  const required = calculateRequiredTrainingPoints({
    talent: input.talentEstimate.value,
    age: input.age,
    skill: trainingSkill,
    targetSkillLevel: input.currentSkillLevel + 1
  });

  return {
    targetLevel: input.currentSkillLevel + 1,
    estimatedWeeks: required.requiredTrainingPoints / input.latestReport.intensity
  };
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
    playerId: player.id,
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

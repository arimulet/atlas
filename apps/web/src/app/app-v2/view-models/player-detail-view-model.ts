import { formatTrainingPriority } from "@atlas/web/app/formatters";
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
    confidence?: "low" | "medium" | "high";
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
  trainingHistory: [];
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
      candidate.id === input.playerId ||
      input.development?.observed.players.some(
        (observed) =>
          observed.snapshotPlayerId === candidate.id && observed.playerId === input.playerId
      )
  );

  if (!player) {
    return null;
  }

  const observedPlayer = input.development?.observed.players.find(
    (candidate) => candidate.snapshotPlayerId === player.id
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

  return {
    player: {
      id: player.id,
      name: player.name,
      age: player.age
    },
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
      estimated: null
    },
    projection: {
      current: {
        skill: trainedSkill === null ? null : formatTrainingPriority(trainedSkill),
        level: currentSkillLevel,
        progress: trainingRow.progress
      }
    },
    diagnostics: diagnosticFindingsForPlayer(input.trainingDiagnostic, player),
    recentSkillUps: createRecentSkillUps(input.development, observedPlayer?.playerId ?? null),
    trainingHistory: []
  };
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
  development: PlayerDevelopment | null,
  playerId: string | null
): PlayerDetailViewModel["recentSkillUps"] {
  const summary = development?.derived.players.find((candidate) => candidate.playerId === playerId);

  return (summary?.skillChanges ?? [])
    .filter(
      (change) =>
        change.direction === "up" && change.previousValue !== null && change.currentValue !== null
    )
    .map((change) => ({
      date: development?.observed.latestSnapshotDate ?? null,
      skill: skillLabelForKey(change.skill),
      fromLevel: change.previousValue as number,
      toLevel: change.currentValue as number
    }))
    .slice(0, 10);
}

function skillLabelForKey(skill: string): string {
  const definition = SKILL_DEFINITIONS.find((candidate) => candidate.key === skill);
  return definition === undefined ? skill : formatTrainingPriority(definition.trainingPriority);
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
    advanced: player.training.advanced,
    minutes: null,
    efficiency: null,
    progress: null,
    talent: null,
    nextSkillUp: null,
    etaWeeks: null,
    status: trainingStatusForPlayer(player, diagnostic)
  };
}

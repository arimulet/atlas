import { formatTrainingPriority } from "../formatters";
import type {
  PlayerDevelopment,
  SquadPlanningBundle,
  TrainingPageData
} from "@atlas/web/app/types";
import {
  createTrainingPlayerRows,
  trainedSkillForPosition,
  trainingPositionCode,
  type TrainingDiagnostic,
  type TrainingStatusLabel
} from "./training-view-model";
import type { PlayerTrainingProjectionSummary } from "./player-detail-view-model";
import {
  createPlayerMarketValueViewModel,
  type PlayerMarketValueViewModel
} from "./market-value-view-model";

export const SQUAD_SKILL_DEFINITIONS = [
  { key: "stamina", shortLabel: "STA", trainingPriority: 1 },
  { key: "pace", shortLabel: "PAC", trainingPriority: 8 },
  { key: "technique", shortLabel: "TEC", trainingPriority: 5 },
  { key: "passing", shortLabel: "PAS", trainingPriority: 4 },
  { key: "keeper", shortLabel: "GK", trainingPriority: 2 },
  { key: "defender", shortLabel: "DEF", trainingPriority: 6 },
  { key: "playmaker", shortLabel: "PM", trainingPriority: 3 },
  { key: "striker", shortLabel: "SCO", trainingPriority: 7 }
] as const;

export type SquadSkillKey = (typeof SQUAD_SKILL_DEFINITIONS)[number]["key"];

export interface SquadPlayerRow {
  playerId: string;
  playerName: string;
  age: number;
  form: number | null;
  skills: Record<SquadSkillKey, number | null>;
  training: {
    position: string | null;
    trainedSkill: string | null;
    trainingType: string | null;
    trainingKind: "advanced" | "formation" | "missing" | null;
    intensity: number | null;
    progress: number | null;
    status: TrainingStatusLabel | null;
  };
  development: {
    talent: number | null;
    nextSkillUp: number | null;
    etaWeeks: number | null;
  };
  marketValue?: PlayerMarketValueViewModel | null;
}

export interface CreateSquadPlayerRowsInput {
  development: PlayerDevelopment | null;
  training: TrainingPageData | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: "idle" | "loading" | "ready" | "error";
  projectionSummaries?: ReadonlyMap<string, PlayerTrainingProjectionSummary>;
  squadPlanning?: SquadPlanningBundle | null;
  currency?: string | null;
}

export function createSquadPlayerRows(input: CreateSquadPlayerRowsInput): SquadPlayerRow[] {
  const trainingRows = createTrainingPlayerRows(
    input.training?.players ?? [],
    input.trainingStatus === "ready" ? input.trainingDiagnostic : null,
    input.projectionSummaries
  );
  const trainingRowsByPlayerId = new Map(
    trainingRows.map((trainingRow) => [trainingRow.playerId, trainingRow])
  );

  return (input.training?.players ?? []).map((player) => {
    const observedPlayer = input.development?.observed.players.find(
      (candidate) => candidate.snapshotPlayerId === player.id
    );
    const trainingPosition = trainingPositionCode(player.training.position);
    const trainedSkill = trainedSkillForPosition(
      input.training?.configuration ?? null,
      player.training.position
    );
    const playerId = String(player.playerId);
    const trainingRow = trainingRowsByPlayerId.get(playerId);
    const marketPlayer = input.squadPlanning?.assessment.depthPlayers.find(
      (candidate) =>
        identifiersMatch(candidate.playerId, observedPlayer?.playerId) ||
        identifiersMatch(candidate.playerId, player.playerId)
    );

    return {
      playerId: observedPlayer?.playerId?.toString() ?? playerId,
      playerName: player.name,
      age: player.age,
      form: player.form ?? null,
      skills: createSkillValues(observedPlayer?.skills ?? null),
      training: {
        position: trainingPosition,
        trainedSkill: trainedSkill === null ? null : formatTrainingPriority(trainedSkill),
        trainingType: trainingRow?.trainingType ?? null,
        trainingKind: trainingRow?.trainingKind ?? null,
        intensity: trainingRow?.intensity ?? null,
        progress: trainingRow?.progress ?? null,
        status: trainingRow?.status ?? null
      },
      development: {
        talent: trainingRow?.talent ?? null,
        nextSkillUp: trainingRow?.nextSkillUp ?? null,
        etaWeeks: trainingRow?.etaWeeks ?? null
      },
      marketValue: marketPlayer
        ? createPlayerMarketValueViewModel(marketPlayer, input.currency ?? null)
        : null
    };
  });
}

function identifiersMatch(
  left: string | number | null | undefined,
  right: string | number | null | undefined
): boolean {
  return left !== null && left !== undefined && right !== null && right !== undefined
    ? String(left) === String(right)
    : false;
}

export function createSquadAttentionFindings(
  diagnostic: TrainingDiagnostic | null
): TrainingDiagnostic["findings"] {
  return [...(diagnostic?.findings ?? [])].sort(compareDiagnosticSeverity).slice(0, 5);
}

function createSkillValues(
  skills: PlayerDevelopment["observed"]["players"][number]["skills"] | null
): Record<SquadSkillKey, number | null> {
  return SQUAD_SKILL_DEFINITIONS.reduce<Record<SquadSkillKey, number | null>>(
    (values, definition) => {
      values[definition.key] = skills?.[definition.key] ?? null;
      return values;
    },
    {
      stamina: null,
      pace: null,
      technique: null,
      passing: null,
      keeper: null,
      defender: null,
      playmaker: null,
      striker: null
    }
  );
}

function compareDiagnosticSeverity(
  first: TrainingDiagnostic["findings"][number],
  second: TrainingDiagnostic["findings"][number]
): number {
  const severityOrder: Record<TrainingDiagnostic["findings"][number]["severity"], number> = {
    high: 0,
    medium: 1,
    low: 2,
    info: 3
  };

  return severityOrder[first.severity] - severityOrder[second.severity];
}

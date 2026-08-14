import { formatTrainingPriority } from "@atlas/web/app/formatters";
import type { PlayerDevelopment, TrainingPageData } from "@atlas/web/app/types";
import {
  createTrainingPlayerRows,
  trainedSkillForPosition,
  trainingPositionCode,
  type TrainingDiagnostic,
  type TrainingStatusLabel
} from "./training-view-model";

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
  position: string | null;
  skills: Record<SquadSkillKey, number | null>;
  training: {
    position: string | null;
    trainedSkill: string | null;
    advanced: boolean;
    efficiency: number | null;
    status: TrainingStatusLabel | null;
  };
}

export interface CreateSquadPlayerRowsInput {
  development: PlayerDevelopment | null;
  training: TrainingPageData | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: "idle" | "loading" | "ready" | "error";
}

export function createSquadPlayerRows(input: CreateSquadPlayerRowsInput): SquadPlayerRow[] {
  return (input.training?.players ?? []).map((player) => {
    const observedPlayer = input.development?.observed.players.find(
      (candidate) => candidate.snapshotPlayerId === player.id
    );
    const trainingPosition = trainingPositionCode(player.training.position);
    const trainedSkill = trainedSkillForPosition(
      input.training?.configuration ?? null,
      player.training.position
    );
    const trainingRow = createTrainingPlayerRows(
      [player],
      input.trainingStatus === "ready" ? input.trainingDiagnostic : null
    )[0];

    return {
      playerId: observedPlayer?.playerId?.toString() ?? player.id,
      playerName: player.name,
      age: player.age,
      position: observedPositionCode(observedPlayer?.observedPosition ?? null),
      skills: createSkillValues(observedPlayer?.skills ?? null),
      training: {
        position: trainingPosition,
        trainedSkill: trainedSkill === null ? null : formatTrainingPriority(trainedSkill),
        advanced: trainingRow?.advanced ?? player.training.advanced,
        efficiency: trainingRow?.efficiency ?? null,
        status: trainingRow?.status ?? null
      }
    };
  });
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

function observedPositionCode(position: string | null): string | null {
  if (position === null) {
    return null;
  }

  const positionCodes: Record<string, string> = {
    goalkeeper: "GK",
    defender: "DEF",
    midfielder: "MID",
    winger: "WING",
    striker: "ATT"
  };

  return positionCodes[position] ?? position;
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

import type { DiagnosticFinding, TrainingPageData, TrainingPagePlayer } from "@atlas/web/app/types";
import type { PlayerTrainingProjectionSummary } from "./player-detail-view-model";

export type TrainingStatusLabel = "Critical" | "Attention" | "Training prospect" | "Info";

export interface TrainingPlayerRow {
  playerId: string;
  playerName: string;
  trainingPosition: number;
  age: number;
  trainingType: string | null;
  trainingKind: "advanced" | "formation" | "missing" | null;
  intensity: number | null;
  skillChanges: Array<{ skill: string; delta: number }>;
  progress: number | null;
  talent: number | null;
  nextSkillUp: number | null;
  etaWeeks: number | null;
  status: TrainingStatusLabel | null;
}

export interface TrainingDiagnostic {
  findings: DiagnosticFinding[];
}

export const TRAINING_POSITIONS = [
  { code: "GK", trainingPosition: 0 },
  { code: "DEF", trainingPosition: 1 },
  { code: "MID", trainingPosition: 2 },
  { code: "ATT", trainingPosition: 3 }
] as const;

export type TrainingPositionCode = (typeof TRAINING_POSITIONS)[number]["code"];

export function createTrainingPlayerRows(
  players: TrainingPagePlayer[],
  diagnostic: TrainingDiagnostic | null,
  projectionSummaries?: ReadonlyMap<string, PlayerTrainingProjectionSummary>
): TrainingPlayerRow[] {
  return players.map((player) => {
    const playerId = String(player.playerId);
    const projectionSummary = projectionSummaries?.get(playerId);

    return {
      playerId,
      playerName: player.name,
      trainingPosition: player.training.position,
      age: player.age,
      trainingType: player.latestReport?.type ?? null,
      trainingKind: player.latestReport?.kind ?? null,
      intensity: player.latestReport?.intensity ?? null,
      skillChanges: visibleSkillChanges(player.latestReport),
      progress: projectionSummary?.progress ?? null,
      talent: projectionSummary?.talent ?? null,
      nextSkillUp: projectionSummary?.nextSkillUp ?? null,
      etaWeeks: projectionSummary?.etaWeeks ?? null,
      status: trainingStatusForPlayer(player, diagnostic)
    };
  });
}

function visibleSkillChanges(
  report: TrainingPagePlayer["latestReport"]
): Array<{ skill: string; delta: number }> {
  if (!report) {
    return [];
  }

  return (report.skillChanges ?? []).map((change) => ({
    skill: change.skill,
    delta: change.delta
  }));
}

export function trainingStatusForPlayer(
  player: TrainingPagePlayer,
  diagnostic: TrainingDiagnostic | null
): TrainingStatusLabel | null {
  const findings =
    diagnostic?.findings.filter(
      (finding) =>
        finding.category === "training-potential" &&
        isFindingForPlayer(finding, String(player.playerId), player.name, player.id)
    ) ?? [];

  return findings.length === 0 ? null : "Training prospect";
}

export function diagnosticFindingsForPlayer(
  diagnostic: TrainingDiagnostic | null,
  player: TrainingPagePlayer
): DiagnosticFinding[] {
  return (
    diagnostic?.findings.filter((finding) =>
      isFindingForPlayer(finding, String(player.playerId), player.name, player.id)
    ) ?? []
  ).sort(compareDiagnosticSeverity);
}

export function isFindingForPlayer(
  finding: DiagnosticFinding,
  playerId: string,
  playerName: string,
  stablePlayerId?: string | number
): boolean {
  return (
    finding.parameters?.playerName === playerName ||
    finding.affectedPlayerIds.includes(playerId) ||
    (stablePlayerId !== undefined && finding.affectedPlayerIds.includes(String(stablePlayerId)))
  );
}

export function trainingPositionCode(position: number): TrainingPositionCode | null {
  return TRAINING_POSITIONS.find((item) => item.trainingPosition === position)?.code ?? null;
}

export function trainedSkillForPosition(
  configuration: TrainingPageData["configuration"],
  position: number
): number | null {
  const positionCode = trainingPositionCode(position);

  return positionCode === null || configuration === null ? null : configuration[positionCode];
}

export function compareDiagnosticSeverity(
  first: DiagnosticFinding,
  second: DiagnosticFinding
): number {
  const severityOrder: Record<DiagnosticFinding["severity"], number> = {
    high: 0,
    medium: 1,
    low: 2,
    info: 3
  };

  return severityOrder[first.severity] - severityOrder[second.severity];
}

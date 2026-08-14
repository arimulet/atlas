import type { DashboardStatus, DiagnosticFinding, TrainingPageData } from "@atlas/web/app/types";

export type TrainingStatusLabel = "Critical" | "Attention" | "Info";

export interface TrainingPlayerRow {
  playerId: string;
  playerName: string;
  trainingPosition: number;
  age: number;
  advanced: boolean;
  minutes: number | null;
  efficiency: number | null;
  progress: number | null;
  status: TrainingStatusLabel | null;
}

export interface TrainingV2Props {
  training: TrainingPageData | null;
  trainingDiagnostic: { findings: DiagnosticFinding[] } | null;
  trainingStatus: DashboardStatus;
}

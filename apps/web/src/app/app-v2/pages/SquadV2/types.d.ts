import type {
  DashboardStatus,
  DiagnosticFinding,
  PlayerDevelopment,
  TrainingPageData
} from "@atlas/web/app/types";
import type { TrainingDiagnostic } from "../../view-models/training-view-model";
import type { SquadPlayerRow } from "../../view-models/squad-view-model";

export interface SquadV2Props {
  development: PlayerDevelopment | null;
  onSelectPlayer: (playerId: string) => void;
  training: TrainingPageData | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: DashboardStatus;
}

export interface SquadAttentionProps {
  diagnostic: TrainingDiagnostic | null;
  status: DashboardStatus;
}

export interface SquadTableProps {
  onSelectPlayer: (playerId: string) => void;
  rows: SquadPlayerRow[];
  status: DashboardStatus;
}

export type SquadAttentionFinding = DiagnosticFinding;

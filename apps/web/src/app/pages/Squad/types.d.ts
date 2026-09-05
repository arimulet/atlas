import type {
  DashboardStatus,
  DiagnosticFinding,
  PlayerDevelopment,
  SquadPlanningBundle,
  SquadRole,
  TrainingPageData
} from "@atlas/web/app/types";
import type { TrainingDiagnostic } from "../../view-models/training-view-model";
import type { PlayerTrainingProjectionSummary } from "../../view-models/player-detail-view-model";
import type { SquadPlayerRow } from "../../view-models/squad-view-model";

export interface SquadProps {
  development: PlayerDevelopment | null;
  onSelectPlayer?: (playerId: string) => void;
  onSaveSquadRole?: (playerId: string, role: SquadRole | null) => Promise<void>;
  projectionSummaries?: ReadonlyMap<string, PlayerTrainingProjectionSummary>;
  squadPlanning: SquadPlanningBundle | null;
  squadPlanningStatus: DashboardStatus;
  training: TrainingPageData | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: DashboardStatus;
  currency?: string | null;
}

export interface SquadAttentionProps {
  diagnostic: TrainingDiagnostic | null;
  status: DashboardStatus;
}

export interface SquadTableProps {
  onSaveSquadRole?: (playerId: string, role: SquadRole | null) => Promise<void>;
  onSelectPlayer?: (playerId: string) => void;
  planning: SquadPlanningBundle | null;
  rows: SquadPlayerRow[];
  status: DashboardStatus;
}

export type SquadAttentionFinding = DiagnosticFinding;

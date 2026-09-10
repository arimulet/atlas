import type {
  DashboardStatus,
  DiagnosticFinding,
  PlayerDevelopment,
  SquadPlanningBundle,
  SquadRole,
  TrainingPageData
} from "@atlas/web/app/types";
import type { TrainingDiagnostic } from "@/app/view-models/training-view-model";
import type { PlayerTrainingProjectionSummary } from "@/app/view-models/player-detail-view-model";
import type { SquadPlayerRow } from "@/app/view-models/squad-view-model";

export interface SquadProps {
  development: PlayerDevelopment | null;
  onSelectPlayer: (playerId: string) => void;
  onSaveSquadRole: (playerId: string, role: SquadRole | null) => Promise<void>;
  projectionSummaries?: ReadonlyMap<string, PlayerTrainingProjectionSummary>;
  squadPlanning: SquadPlanningBundle | null;
  squadPlanningStatus: DashboardStatus;
  training: TrainingPageData | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: DashboardStatus;
  currency: string | null;
}

export interface SquadAttentionProps {
  diagnostic: TrainingDiagnostic | null;
  status: DashboardStatus;
}

export interface SquadTableProps {
  onSaveSquadRole: (playerId: string, role: SquadRole | null) => Promise<void>;
  onSelectPlayer: (playerId: string) => void;
  planning: SquadPlanningBundle | null;
  rows: SquadPlayerRow[];
  status: DashboardStatus;
}

export type SquadAttentionFinding = DiagnosticFinding;

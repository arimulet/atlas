import type {
  DashboardStatus,
  DiagnosticFinding,
  PlayerDevelopment,
  TrainingPageData
} from "@atlas/web/app/types";
export type { TrainingPlayerRow, TrainingStatusLabel } from "../../view-models/training-view-model";
import type { PlayerTrainingProjectionSummary } from "../../view-models/player-detail-view-model";

export interface TrainingProps {
  clubId?: string | null;
  development: PlayerDevelopment | null;
  training: TrainingPageData | null;
  trainingDiagnostic: { findings: DiagnosticFinding[] } | null;
  trainingStatus: DashboardStatus;
  onSelectPlayer?: (playerId: string) => void;
  projectionSummaries?: ReadonlyMap<string, PlayerTrainingProjectionSummary>;
}

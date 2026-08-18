import type { DashboardStatus, PlayerDevelopment } from "@atlas/web/app/types";
import type { TrainingDiagnostic } from "../../view-models/training-view-model";

export interface PlayerDetailProps {
  playerId: string;
  training: import("@atlas/web/app/types").TrainingPageData | null;
  development: PlayerDevelopment | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: DashboardStatus;
  onBack: () => void;
  onBackToSquad: () => void;
}

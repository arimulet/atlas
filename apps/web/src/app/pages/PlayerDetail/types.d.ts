import type { DashboardStatus, PlayerDevelopment, SquadPlanningBundle } from "@atlas/web/app/types";
import type { TrainingDiagnostic } from "../../view-models/training-view-model";

export interface PlayerDetailProps {
  clubId?: string | null;
  playerId: string;
  training: import("@atlas/web/app/types").TrainingPageData | null;
  development: PlayerDevelopment | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: DashboardStatus;
  squadPlanning: SquadPlanningBundle | null;
  currency?: string | null;
  onBack?: () => void;
  onBackToSquad?: () => void;
}

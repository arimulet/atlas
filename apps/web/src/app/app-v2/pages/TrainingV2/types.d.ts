import type { DashboardStatus, DiagnosticFinding, TrainingPageData } from "@atlas/web/app/types";
export type { TrainingPlayerRow, TrainingStatusLabel } from "../../view-models/training-view-model";

export interface TrainingV2Props {
  training: TrainingPageData | null;
  trainingDiagnostic: { findings: DiagnosticFinding[] } | null;
  trainingStatus: DashboardStatus;
  onSelectPlayer: (playerId: string) => void;
}

import type { DashboardStatus, DiagnosticFinding, TrainingPageData } from "@atlas/web/app/types";

export interface TrainingV2Props {
  training: TrainingPageData | null;
  trainingDiagnostic: { findings: DiagnosticFinding[] } | null;
  trainingStatus: DashboardStatus;
}

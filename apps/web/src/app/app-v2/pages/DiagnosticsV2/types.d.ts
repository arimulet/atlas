import type {
  DashboardStatus,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  TrainingPageData,
  YouthPipelinePlanning
} from "@atlas/web/app/types";
import type { TrainingDiagnostic } from "../../view-models/training-view-model";

export interface DiagnosticsV2Props {
  dashboardStatus: DashboardStatus;
  development: PlayerDevelopment | null;
  onSelectPlayer: (playerId: string) => void;
  training: TrainingPageData | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: DashboardStatus;
  youthAcademy: RealYouthAcademyPlanning | null;
  youthPipeline: YouthPipelinePlanning | null;
  youthPipelineStatus: DashboardStatus;
  youthStatus: DashboardStatus;
}

import type { DashboardStatus, TrainingPageData } from "@atlas/web/app/types";

export interface TrainingV2Props {
  training: TrainingPageData | null;
  trainingStatus: DashboardStatus;
}

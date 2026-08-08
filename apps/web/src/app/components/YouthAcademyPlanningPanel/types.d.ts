import { DashboardStatus, RealYouthAcademyPlanning } from "@atlas/web/app/types";

export interface YouthAcademyPlanningPanelProps {
  realYouthAcademyPlanning: RealYouthAcademyPlanning | null;
  status: DashboardStatus;
  onBack: () => void;
}

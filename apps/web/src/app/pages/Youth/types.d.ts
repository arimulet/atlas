import type { DashboardStatus, RealYouthAcademyPlanning } from "@atlas/web/app/types";

export interface YouthProps {
  youthAcademy: RealYouthAcademyPlanning | null;
  youthStatus: DashboardStatus;
}

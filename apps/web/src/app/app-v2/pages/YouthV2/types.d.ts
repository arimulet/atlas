import type { DashboardStatus, RealYouthAcademyPlanning } from "@atlas/web/app/types";

export interface YouthV2Props {
  youthAcademy: RealYouthAcademyPlanning | null;
  youthStatus: DashboardStatus;
}

import type { DashboardStatus, RealYouthAcademyPlanning } from "@atlas/web/app/types";

export interface YouthProps {
  clubId: string | null;
  currency: string | null;
  youthAcademy: RealYouthAcademyPlanning | null;
  youthStatus: DashboardStatus;
}

import type { DashboardStatus, RealYouthAcademyPlanning } from "@atlas/web/app/types";

export interface YouthProps {
  clubId: string | null;
  currency: string | null;
  onSelectPlayer: (playerId: string) => void;
  youthAcademy: RealYouthAcademyPlanning | null;
  youthStatus: DashboardStatus;
}

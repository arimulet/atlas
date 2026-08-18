import type {
  DashboardStatus,
  ClubDashboard,
  RealYouthAcademyPlanning
} from "@atlas/web/app/types";

export interface DashboardProps {
  dashboard: ClubDashboard | null;
  dashboardStatus: DashboardStatus;
  onSelectPlayer: (playerId: string) => void;
  youthAcademy: RealYouthAcademyPlanning | null;
  youthStatus: DashboardStatus;
}

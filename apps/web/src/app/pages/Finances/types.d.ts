import type { ClubDashboard, DashboardStatus, SquadPlanningBundle } from "@atlas/web/app/types";

export interface FinancesProps {
  status: DashboardStatus;
  dashboard: ClubDashboard | null;
  squadPlanning: SquadPlanningBundle | null;
  onSelectPlayer: (playerId: string) => void;
}

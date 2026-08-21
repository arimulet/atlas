import type {
  DashboardStatus,
  ClubDashboard,
  RealYouthAcademyPlanning,
  SquadPlanningBundle
} from "@atlas/web/app/types";
import type { FinancialStrategyState } from "../../features/financialStrategy/useFinancialStrategy";

export interface DashboardProps {
  dashboard: ClubDashboard | null;
  dashboardStatus: DashboardStatus;
  onSelectPlayer: (playerId: string) => void;
  youthAcademy: RealYouthAcademyPlanning | null;
  squadPlanning: SquadPlanningBundle | null;
  squadPlanningStatus: DashboardStatus;
  youthStatus: DashboardStatus;
  financialStrategy: FinancialStrategyState;
}

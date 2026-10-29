import type {
  DashboardStatus,
  ClubDashboard,
  RealYouthAcademyPlanning,
  SquadPlanningBundle
} from "@atlas/web/app/types";
import type { FinancialStrategyState } from "@/app/features/financialStrategy/useFinancialStrategy";
import type { ActionQueueView } from "./action-queue-view-model";

export interface DashboardProps {
  dashboard: ClubDashboard | null;
  dashboardStatus: DashboardStatus;
  onNavigateToView: (view: ActionQueueView) => void;
  onSelectPlayer: (playerId: string) => void;
  youthAcademy: RealYouthAcademyPlanning | null;
  squadPlanning: SquadPlanningBundle | null;
  squadPlanningStatus: DashboardStatus;
  youthStatus: DashboardStatus;
  financialStrategy: FinancialStrategyState;
}

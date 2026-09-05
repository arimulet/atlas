import type { ClubDashboard, DashboardStatus, SquadPlanningBundle } from "@atlas/web/app/types";
import type { FinancialStrategyState } from "../../features/financialStrategy/useFinancialStrategy";

export interface FinancesProps {
  status: DashboardStatus;
  dashboard: ClubDashboard | null;
  squadPlanning: SquadPlanningBundle | null;
  onSelectPlayer?: (playerId: string) => void;
  financialStrategy?: FinancialStrategyState | null;
}

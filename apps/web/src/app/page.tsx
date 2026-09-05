"use client";

import { Dashboard } from "./pages/Dashboard";
import { useClubData } from "./context/ClubDataContext";

export default function DashboardPage() {
  const clubData = useClubData();

  return (
    <Dashboard
      dashboard={clubData.dashboard}
      dashboardStatus={clubData.dashboardStatus}
      youthAcademy={clubData.youthAcademy}
      youthStatus={clubData.youthStatus}
      squadPlanning={clubData.squadPlanning}
      squadPlanningStatus={clubData.squadPlanningStatus}
      financialStrategy={clubData.financialStrategy}
    />
  );
}

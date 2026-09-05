"use client";

import { Finances } from "../pages/Finances";
import { useClubData } from "../context/ClubDataContext";

export default function FinancesPage() {
  const clubData = useClubData();

  return (
    <Finances
      dashboard={clubData.dashboard}
      squadPlanning={clubData.squadPlanning}
      status={clubData.dashboardStatus}
      financialStrategy={clubData.financialStrategy}
    />
  );
}

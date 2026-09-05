"use client";

import { Squad } from "../pages/Squad";
import { useClubData } from "../context/ClubDataContext";

export default function SquadPage() {
  const clubData = useClubData();

  return (
    <Squad
      currency={clubData.dashboard?.club.currency ?? null}
      development={clubData.playerDevelopment}
      onSaveSquadRole={clubData.saveSquadRole}
      projectionSummaries={clubData.projectionSummaries}
      squadPlanning={clubData.squadPlanning}
      squadPlanningStatus={clubData.squadPlanningStatus}
      training={clubData.training}
      trainingDiagnostic={clubData.trainingDiagnostic}
      trainingStatus={clubData.trainingStatus}
    />
  );
}

"use client";

import { Training } from "../pages/Training";
import { useClubData } from "../context/ClubDataContext";

export default function TrainingPage() {
  const clubData = useClubData();

  return (
    <Training
      clubId={clubData.activeClubId}
      development={clubData.playerDevelopment}
      projectionSummaries={clubData.projectionSummaries}
      training={clubData.training}
      trainingDiagnostic={clubData.trainingDiagnostic}
      trainingStatus={clubData.trainingStatus}
    />
  );
}

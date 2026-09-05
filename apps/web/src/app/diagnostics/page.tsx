"use client";

import { Diagnostics } from "../pages/Diagnostics";
import { useClubData } from "../context/ClubDataContext";

export default function DiagnosticsPage() {
  const clubData = useClubData();

  return (
    <Diagnostics
      dashboardStatus={clubData.dashboardStatus}
      development={clubData.playerDevelopment}
      training={clubData.training}
      trainingDiagnostic={clubData.trainingDiagnostic}
      trainingStatus={clubData.trainingStatus}
      youthAcademy={clubData.youthAcademy}
      youthStatus={clubData.youthStatus}
      youthPipeline={clubData.youthPipeline}
      youthPipelineStatus={clubData.youthPipelineStatus}
    />
  );
}

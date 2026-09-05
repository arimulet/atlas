"use client";

import { use } from "react";
import { PlayerDetail } from "../../pages/PlayerDetail";
import { useClubData } from "../../context/ClubDataContext";

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: playerId } = use(params);
  const clubData = useClubData();

  return (
    <PlayerDetail
      clubId={clubData.activeClubId}
      currency={clubData.dashboard?.club.currency ?? null}
      development={clubData.playerDevelopment}
      playerId={decodeURIComponent(playerId)}
      squadPlanning={clubData.squadPlanning}
      training={clubData.training}
      trainingDiagnostic={clubData.trainingDiagnostic}
      trainingStatus={clubData.trainingStatus}
    />
  );
}

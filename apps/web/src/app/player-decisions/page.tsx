"use client";

import { PlayerDecisions } from "../pages/PlayerDecisions";
import { useClubData } from "../context/ClubDataContext";

export default function PlayerDecisionsPage() {
  const clubData = useClubData();

  return (
    <PlayerDecisions
      clubId={clubData.activeClubId}
      currency={clubData.dashboard?.club.currency ?? null}
    />
  );
}

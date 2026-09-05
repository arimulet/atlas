"use client";

import { Youth } from "../pages/Youth";
import { useClubData } from "../context/ClubDataContext";

export default function YouthPage() {
  const clubData = useClubData();

  return (
    <Youth
      clubId={clubData.activeClubId}
      currency={clubData.dashboard?.club.currency ?? null}
      youthAcademy={clubData.youthAcademy}
      youthStatus={clubData.youthStatus}
    />
  );
}

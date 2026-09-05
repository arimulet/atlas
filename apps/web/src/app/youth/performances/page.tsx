"use client";

import { YouthPerformances } from "../../pages/Youth/YouthPerformances";
import { useClubData } from "../../context/ClubDataContext";

export default function YouthPerformancesPage() {
  const clubData = useClubData();

  return (
    <YouthPerformances
      clubId={clubData.activeClubId}
      youthAcademy={clubData.youthAcademy}
    />
  );
}

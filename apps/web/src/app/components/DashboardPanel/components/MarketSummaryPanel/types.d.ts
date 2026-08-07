import type { ClubDashboard } from "../../../../types";

export interface MarketSummaryPanelProps {
    dashboard: ClubDashboard;
    onOpenSquadMarketPlanning ?: () => void;
}
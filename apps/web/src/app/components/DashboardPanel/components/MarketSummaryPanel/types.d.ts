import type { ClubDashboard } from "@atlas/web/app/types";

export interface MarketSummaryPanelProps {
    dashboard: ClubDashboard;
    onOpenSquadMarketPlanning ?: () => void;
}
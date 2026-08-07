import type { ClubDashboard } from "../../../../types";

export interface DevelopmentSummaryPanelProps {
  dashboard: ClubDashboard;
  onOpenPlayerDevelopment?: () => void;
}
import type { ClubDashboard } from "@atlas/web/app/types";

export interface DevelopmentSummaryPanelProps {
  dashboard: ClubDashboard;
  onOpenPlayerDevelopment?: () => void;
}
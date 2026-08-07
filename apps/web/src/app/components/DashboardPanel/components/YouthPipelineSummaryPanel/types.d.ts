import type { ClubDashboard } from "@atlas/web/app/types";

export interface YouthPipelineSummaryPanelProps {
  dashboard: ClubDashboard;
  onOpenYouthPipelinePlanning?: () => void;
}
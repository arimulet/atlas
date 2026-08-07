export interface DashboardPanelProps {
  dashboard: ClubDashboard | null;
  status: DashboardStatus;
  onOpenSquadEconomy?: () => void;
  onOpenPlayerDevelopment?: () => void;
  onOpenSquadMarketPlanning?: () => void;
  onOpenYouthPipelinePlanning?: () => void;
}
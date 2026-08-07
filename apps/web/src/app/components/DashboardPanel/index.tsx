import { EmptyDashboardPanel } from "../EmptyDashboardPanel";
import { ModuleGrid } from "../ModuleGrid";
import { ClubProfilePanel } from "./components/ClubProfilePanel";
import { DevelopmentSummaryPanel } from "./components/DevelopmentSummaryPanel";
import { MarketSummaryPanel } from "./components/MarketSummaryPanel";
import { OperatingSettingsPanel } from "./components/OperatingSettingsPanel";
import { SnapshotAvailabilityPanel } from "./components/SnapshotAvailabilityPanel";
import { YouthPipelineSummaryPanel } from "./components/YouthPipelineSummaryPanel";

import { DashboardPanelProps } from "./types";

export const DashboardPanel = ({
  dashboard,
  status,
  onOpenSquadEconomy,
  onOpenPlayerDevelopment,
  onOpenSquadMarketPlanning,
  onOpenYouthPipelinePlanning
}: DashboardPanelProps) => {
  if (status === "loading") {
    return (
      <section className="panel">
        <p className="loading">Loading club dashboard...</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="panel issue-panel error">
        <div className="panel-heading">
          <p className="eyebrow">Club Dashboard</p>
          <h2>Club could not be loaded</h2>
        </div>
        <p className="muted">Import a fresh snapshot to select the active club again.</p>
      </section>
    );
  }

  if (!dashboard) {
    return <EmptyDashboardPanel />;
  }

  return (
    <section className="dashboard-grid">
      <ClubProfilePanel dashboard={dashboard} />
      <OperatingSettingsPanel dashboard={dashboard} />
      <SnapshotAvailabilityPanel dashboard={dashboard} />
      <DevelopmentSummaryPanel
        dashboard={dashboard}
        onOpenPlayerDevelopment={onOpenPlayerDevelopment}
      />
      <MarketSummaryPanel
        dashboard={dashboard}
        onOpenSquadMarketPlanning={onOpenSquadMarketPlanning}
      />
      <YouthPipelineSummaryPanel
        dashboard={dashboard}
        onOpenYouthPipelinePlanning={onOpenYouthPipelinePlanning}
      />
      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Access</p>
          <h2>Operational areas</h2>
        </div>
        <ModuleGrid
          areas={dashboard.operationalAreas}
          onOpenSquadEconomy={onOpenSquadEconomy}
          onOpenPlayerDevelopment={onOpenPlayerDevelopment}
          onOpenSquadMarketPlanning={onOpenSquadMarketPlanning}
          onOpenYouthPipelinePlanning={onOpenYouthPipelinePlanning}
        />
      </section>
    </section>
  );
}











import { EmptyDashboardPanel } from "@atlas/web/app/components/EmptyDashboardPanel";
import { ModuleGrid } from "@atlas/web/app/components/ModuleGrid";
import { ClubProfilePanel } from "./components/ClubProfilePanel";
import { DevelopmentSummaryPanel } from "./components/DevelopmentSummaryPanel";
import { MarketSummaryPanel } from "./components/MarketSummaryPanel";
import { OperatingSettingsPanel } from "./components/OperatingSettingsPanel";
import { SnapshotAvailabilityPanel } from "./components/SnapshotAvailabilityPanel";
import { YouthPipelineSummaryPanel } from "./components/YouthPipelineSummaryPanel";

import { DashboardPanelProps } from "./types";
import { Section } from "../Section";

export const DashboardPanel = ({
  dashboard,
  status,
  onOpenSquadEconomy,
  onOpenPlayerDevelopment,
  onOpenSquadMarketPlanning,
  onOpenYouthPipelinePlanning
}: DashboardPanelProps) => {
  if (status === "loading") {
    return <Section description="Loading club dashboard..." />;
  }

  if (status === "error") {
    return (
      <Section
        className="issue-panel error"
        title="Club Dashboard"
        subtitle="Club could not be loaded"
        description="Import a fresh snapshot to select the active club again."
      />
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
      <Section title="Access" subtitle="Operational areas">
        <ModuleGrid
          areas={dashboard.operationalAreas}
          onOpenSquadEconomy={onOpenSquadEconomy}
          onOpenPlayerDevelopment={onOpenPlayerDevelopment}
          onOpenSquadMarketPlanning={onOpenSquadMarketPlanning}
          onOpenYouthPipelinePlanning={onOpenYouthPipelinePlanning}
        />
      </Section>
    </section>
  );
};

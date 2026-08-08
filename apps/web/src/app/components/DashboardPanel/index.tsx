import { EmptyDashboardPanel } from "@atlas/web/app/components/EmptyDashboardPanel";
import { ClubProfilePanel } from "./components/ClubProfilePanel";
import { DevelopmentSummaryPanel } from "./components/DevelopmentSummaryPanel";
import { MarketSummaryPanel } from "./components/MarketSummaryPanel";
import { OperatingSettingsPanel } from "./components/OperatingSettingsPanel";
import { SnapshotAvailabilityPanel } from "./components/SnapshotAvailabilityPanel";
import { YouthPipelineSummaryPanel } from "./components/YouthPipelineSummaryPanel";
import { Section } from "@atlas/web/app/components/Section";
import { ModuleCard } from "@atlas/web/app/components/ModuleCard";
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
    return <Section description="Loading club dashboard..." />;
  }

  if (status === "error") {
    return (
      <Section
        tone="error"
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
        <div className="module-grid">
          {dashboard.operationalAreas.map((area) => (
            <ModuleCard
              key={area.key}
              label={area.label}
              summary={area.summary}
              status={area.status}
            >
              {area.key === "squad-economy" && area.status === "available" ? (
                <button type="button" onClick={onOpenSquadEconomy}>
                  Abrir Economia de plantilla
                </button>
              ) : null}
              {area.key === "player-development" && area.status === "available" ? (
                <button type="button" onClick={onOpenPlayerDevelopment}>
                  Abrir desarrollo
                </button>
              ) : null}
              {area.key === "squad-market-planning" && area.status === "available" ? (
                <button type="button" onClick={onOpenSquadMarketPlanning}>
                  Abrir planificacion
                </button>
              ) : null}
              {area.key === "youth-pipeline-planning" && area.status === "available" ? (
                <button type="button" onClick={onOpenYouthPipelinePlanning}>
                  Abrir pipeline juvenil senior
                </button>
              ) : null}
            </ModuleCard>
          ))}
        </div>
        {/* <ModuleGrid
          areas={dashboard.operationalAreas}
          onOpenSquadEconomy={onOpenSquadEconomy}
          onOpenPlayerDevelopment={onOpenPlayerDevelopment}
          onOpenSquadMarketPlanning={onOpenSquadMarketPlanning}
          onOpenYouthPipelinePlanning={onOpenYouthPipelinePlanning}
        /> */}
      </Section>
    </section>
  );
};

import { formatDateTime } from "../formatters";
import type { ClubDashboard, DashboardStatus, OperatingPreferenceKey } from "../types";
import { EmptyDashboardPanel } from "./EmptyDashboardPanel";
import { ModuleGrid } from "./ModuleGrid";
import { PreferenceItem } from "./PreferenceItem";
import { SourcedItem } from "./SourcedItem";
import { SummaryItem } from "./SummaryItem";

const preferenceLabels: Record<OperatingPreferenceKey, string> = {
  "economy.riskTolerance": "Economy risk",
  "training.priority": "Training priority",
  "academy.investment": "Academy investment",
  "market.strategy": "Market strategy"
};

export interface DashboardPanelProps {
  dashboard: ClubDashboard | null;
  status: DashboardStatus;
  onOpenSquadEconomy?: () => void;
}

export function DashboardPanel({ dashboard, status, onOpenSquadEconomy }: DashboardPanelProps) {
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
      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Access</p>
          <h2>Operational areas</h2>
        </div>
        <ModuleGrid areas={dashboard.operationalAreas} onOpenSquadEconomy={onOpenSquadEconomy} />
      </section>
    </section>
  );
}

function ClubProfilePanel({ dashboard }: { dashboard: ClubDashboard }) {
  return (
    <section className="panel club-profile-panel">
      <div className="panel-heading">
        <p className="eyebrow">Club Profile</p>
        <h2>{dashboard.club.profile.name}</h2>
      </div>
      <dl className="source-list">
        <SourcedItem label="Observed name" value={dashboard.club.observed.name} source="observed" />
        <SourcedItem label="Manual name" value={dashboard.club.manual.name} source="manual" />
        <SourcedItem
          label="Effective name"
          value={dashboard.club.profile.name}
          source="effective"
        />
        <SourcedItem
          label="External id"
          value={dashboard.club.profile.externalId}
          source="observed"
        />
        <SourcedItem
          label="Last observed"
          value={formatDateTime(dashboard.club.observed.observedAt)}
          source="observed"
        />
      </dl>
    </section>
  );
}

function OperatingSettingsPanel({ dashboard }: { dashboard: ClubDashboard }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Operating Settings</p>
        <h2>Effective reading</h2>
      </div>
      <div className="settings-columns">
        <dl className="source-list">
          <SourcedItem
            label="Currency"
            value={dashboard.settings.manual.currency}
            source="manual"
          />
          <SourcedItem
            label="Season"
            value={dashboard.settings.observed.season}
            source="observed"
          />
          <SourcedItem label="Week" value={dashboard.settings.observed.week} source="observed" />
        </dl>
        <dl className="source-list effective-list">
          <SourcedItem
            label="Currency"
            value={dashboard.settings.effective.currency}
            source="effective"
          />
          <SourcedItem
            label="Season"
            value={dashboard.settings.effective.season}
            source="effective"
          />
          <SourcedItem label="Week" value={dashboard.settings.effective.week} source="effective" />
        </dl>
      </div>
      <div className="preferences-grid">
        {(Object.keys(preferenceLabels) as OperatingPreferenceKey[]).map((key) => (
          <PreferenceItem
            key={key}
            label={preferenceLabels[key]}
            manual={dashboard.settings.manual.preferences[key]}
            effective={dashboard.settings.effective.preferences[key]}
          />
        ))}
      </div>
    </section>
  );
}

function SnapshotAvailabilityPanel({ dashboard }: { dashboard: ClubDashboard }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Snapshots</p>
        <h2>Historical availability</h2>
      </div>
      <dl className="summary-grid">
        <SummaryItem label="Snapshots" value={dashboard.snapshots.count.toString()} />
        <SummaryItem
          label="Latest snapshot"
          value={dashboard.snapshots.latest?.snapshotDate ?? "Not available"}
        />
        <SummaryItem
          label="Players latest"
          value={dashboard.snapshots.latest?.playerCount.toString() ?? "Not available"}
        />
        <SummaryItem
          label="Comparison"
          value={dashboard.snapshots.canCompare ? "Ready" : "Needs history"}
        />
      </dl>
      {dashboard.snapshots.latest ? (
        <p className="muted">
          Latest import: {formatDateTime(dashboard.snapshots.latest.importedAt)}.
        </p>
      ) : null}
    </section>
  );
}

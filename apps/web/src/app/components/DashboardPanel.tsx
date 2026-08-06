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
  onOpenPlayerDevelopment?: () => void;
  onOpenSquadMarketPlanning?: () => void;
}

export function DashboardPanel({
  dashboard,
  status,
  onOpenSquadEconomy,
  onOpenPlayerDevelopment,
  onOpenSquadMarketPlanning
}: DashboardPanelProps) {
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
        />
      </section>
    </section>
  );
}

function DevelopmentSummaryPanel({
  dashboard,
  onOpenPlayerDevelopment
}: {
  dashboard: ClubDashboard;
  onOpenPlayerDevelopment?: () => void;
}) {
  const summary = dashboard.developmentSummary;

  return (
    <section className="panel development-summary-panel">
      <div className="panel-heading">
        <p className="eyebrow">Desarrollo de jugadores</p>
        <h2>Lectura operativa</h2>
      </div>
      <p className="muted">{summary.inferred.headline}</p>
      <dl className="summary-grid development-counts">
        <SummaryItem label="En mejora" value={summary.derived.improvingPlayers.toString()} />
        <SummaryItem label="Estancados" value={summary.derived.stagnatedPlayers.toString()} />
        <SummaryItem label="En deterioro" value={summary.derived.decliningPlayers.toString()} />
        <SummaryItem
          label="Datos insuficientes"
          value={summary.derived.insufficientDataPlayers.toString()}
        />
      </dl>
      <div className="trace-row" aria-label="Origen de la lectura de desarrollo">
        <span className="trace-kind observed">
          observado: {summary.observed.snapshotCount} snapshots
        </span>
        <span className="trace-kind manual">manual: {summary.manual.trainingPriority}</span>
        <span className="trace-kind derived">derivado: conteos por evolucion</span>
        <span className="trace-kind inferred">inferido: senal ejecutiva</span>
      </div>
      {summary.inferred.warning ? (
        <p className="inline-warning">{summary.inferred.warning}</p>
      ) : null}
      {summary.inferred.highlightedPlayers.length > 0 ? (
        <div className="highlight-list">
          {summary.inferred.highlightedPlayers.map((player) => (
            <article className="highlight-row" key={`${player.playerId ?? player.name}`}>
              <div>
                <strong>{player.name}</strong>
                <span>{labelDevelopmentSignal(player.signal)}</span>
              </div>
              <span className={`severity ${player.severity}`}>{player.confidence}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Importa snapshots comparables para destacar jugadores con senales de evolucion.
        </p>
      )}
      {summary.available ? (
        <button type="button" onClick={onOpenPlayerDevelopment}>
          Abrir detalle de desarrollo
        </button>
      ) : null}
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

function labelDevelopmentSignal(signal: string): string {
  if (signal === "improvement") return "Mejora observada";
  if (signal === "stagnation") return "Estancamiento observado";
  if (signal === "decline") return "Deterioro observado";
  return "Datos insuficientes";
}

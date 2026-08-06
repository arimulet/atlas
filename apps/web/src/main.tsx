import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ImportStatus = "idle" | "loading" | "success" | "error";
type SourceKind = "observed" | "manual" | "effective";

interface ImportIssue {
  path: string;
  message: string;
}

interface MoneyTotal {
  amount: number;
  currency: string | null;
  isComplete: boolean;
}

interface SquadSummary {
  playerCount: number;
  snapshotDate: string;
  club: string;
  totalEstimatedValue: MoneyTotal;
  totalWage: MoneyTotal;
  incompletePlayerCount: number;
}

interface DiagnosticTrace {
  kind: "observed" | "derived" | "assumed" | "recommended";
  label: string;
  value: string | number | null;
}

interface DiagnosticAssumption {
  code: string;
  description: string;
  traceKind: "assumed";
}

interface DiagnosticFinding {
  code: string;
  category: string;
  severity: "info" | "low" | "medium" | "high";
  description: string;
  evidence: DiagnosticTrace[];
  assumptions: DiagnosticAssumption[];
  confidence: "low" | "medium" | "high";
  affectedPlayerIds: string[];
}

interface ImportResponse {
  importResult: {
    status: "accepted" | "accepted-with-warnings" | "rejected";
    errors: ImportIssue[];
    warnings: ImportIssue[];
    clubId: string | null;
    importedPlayerCount: number;
  };
  summary: SquadSummary | null;
  diagnostic: {
    findings: DiagnosticFinding[];
  } | null;
}

interface ManualRecord {
  key: string;
  value: string;
  updatedAt: string;
}

interface ClubDashboard {
  club: {
    id: string;
    observed: {
      externalId: string | null;
      name: string;
      season: number | null;
      week: number | null;
      lastSnapshotDate: string | null;
      sourceType: string | null;
      observedAt: string | null;
    };
    manual: {
      name: string | null;
      currency: string | null;
      season: number | null;
      week: number | null;
      assumptions: ManualRecord[];
      preferences: ManualRecord[];
    };
    profile: {
      externalId: string | null;
      name: string;
      currency: string | null;
      season: number | null;
      week: number | null;
    };
  };
  settings: {
    observed: {
      season: number | null;
      week: number | null;
    };
    manual: {
      currency: string | null;
      season: number | null;
      week: number | null;
      preferences: Partial<Record<OperatingPreferenceKey, string>>;
    };
    effective: {
      currency: string | null;
      season: number | null;
      week: number | null;
      preferences: Record<OperatingPreferenceKey, string>;
    };
  };
  snapshots: {
    available: boolean;
    count: number;
    latest: SnapshotSummary | null;
    previous: SnapshotSummary | null;
    canCompare: boolean;
  };
  operationalAreas: OperationalArea[];
}

interface SnapshotSummary {
  id: string;
  snapshotDate: string;
  importedAt: string;
  season: number | null;
  week: number | null;
  playerCount: number;
}

interface OperationalArea {
  key: string;
  label: string;
  status: "available" | "ready" | "planned";
  summary: string;
}

type OperatingPreferenceKey =
  | "economy.riskTolerance"
  | "training.priority"
  | "academy.investment"
  | "market.strategy";

const lastClubStorageKey = "atlas.lastClubId";
const preferenceLabels: Record<OperatingPreferenceKey, string> = {
  "economy.riskTolerance": "Economy risk",
  "training.priority": "Training priority",
  "academy.investment": "Academy investment",
  "market.strategy": "Market strategy"
};

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeClubId, setActiveClubId] = useState<string | null>(() =>
    window.localStorage.getItem(lastClubStorageKey)
  );
  const [dashboardStatus, setDashboardStatus] = useState<"idle" | "loading" | "ready" | "error">(
    activeClubId ? "loading" : "idle"
  );
  const [dashboard, setDashboard] = useState<ClubDashboard | null>(null);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState("Club dashboard ready.");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [errors, setErrors] = useState<ImportIssue[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const findingsByCategory = useMemo(() => {
    const groups = new Map<string, DiagnosticFinding[]>();

    result?.diagnostic?.findings.forEach((finding) => {
      groups.set(finding.category, [...(groups.get(finding.category) ?? []), finding]);
    });

    return [...groups.entries()];
  }, [result]);

  const loadDashboard = useCallback(async (clubId: string) => {
    setDashboardStatus("loading");

    try {
      const response = await fetch(`/api/clubs/${clubId}/dashboard`);
      const body = (await response.json()) as { dashboard?: ClubDashboard };

      if (!response.ok || !body.dashboard) {
        throw new Error("Dashboard API returned an unexpected response.");
      }

      setDashboard(body.dashboard);
      setDashboardStatus("ready");
    } catch {
      setDashboard(null);
      setDashboardStatus("error");
    }
  }, []);

  useEffect(() => {
    if (activeClubId) {
      void loadDashboard(activeClubId);
    }
  }, [activeClubId, loadDashboard]);

  const importFile = useCallback(
    async (file: File) => {
      setStatus("loading");
      setFileName(file.name);
      setMessage("Importing snapshot...");
      setResult(null);
      setErrors([]);

      try {
        const payload = JSON.parse(await file.text()) as unknown;
        const response = await fetch("/api/imports/player-snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const body = await readImportResponse(response);

        if (!response.ok || body.importResult.status === "rejected") {
          setStatus("error");
          setMessage("Import rejected.");
          setResult(body);
          setErrors(body.importResult.errors);
          return;
        }

        if (body.importResult.clubId) {
          window.localStorage.setItem(lastClubStorageKey, body.importResult.clubId);
          setActiveClubId(body.importResult.clubId);
          await loadDashboard(body.importResult.clubId);
        }

        setStatus("success");
        setMessage(
          body.importResult.status === "accepted-with-warnings"
            ? "Snapshot imported with warnings."
            : "Snapshot imported successfully."
        );
        setResult(body);
      } catch (error) {
        setStatus("error");
        setMessage("Could not read this JSON file.");
        setErrors([
          {
            path: "file",
            message: error instanceof Error ? error.message : "Unknown import error."
          }
        ]);
      }
    },
    [loadDashboard]
  );

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">ATLAS</p>
            <h1>Club dashboard</h1>
          </div>
          <div className={`status-pill ${status}`}>{message}</div>
        </header>

        <DashboardPanel dashboard={dashboard} status={dashboardStatus} />

        <section
          className={`dropzone ${isDragging ? "dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files[0];

            if (file) {
              void importFile(file);
            }
          }}
        >
          <input
            ref={inputRef}
            className="file-input"
            data-testid="snapshot-file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void importFile(file);
              }
            }}
          />
          <div>
            <p className="eyebrow">Operational Intake</p>
            <h2>Import player snapshot JSON</h2>
            <p>
              {fileName ? `Selected: ${fileName}` : "Drop a file here or select a JSON export."}
            </p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()}>
            Select JSON
          </button>
        </section>

        {status === "loading" ? <p className="loading">Processing import...</p> : null}

        {errors.length > 0 ? (
          <IssuePanel title="Blocking errors" tone="error" issues={errors} />
        ) : null}

        {result?.importResult.warnings.length ? (
          <IssuePanel title="Warnings" tone="warning" issues={result.importResult.warnings} />
        ) : null}

        {result?.summary ? <SummaryPanel summary={result.summary} /> : null}

        {findingsByCategory.length > 0 ? (
          <section className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Diagnostic</p>
              <h2>Basic findings</h2>
            </div>
            <div className="finding-list">
              {findingsByCategory.map(([category, findings]) => (
                <section className="finding-group" key={category}>
                  <h3>{formatLabel(category)}</h3>
                  {findings.map((finding) => (
                    <article className="finding-card" key={finding.code}>
                      <div className="finding-header">
                        <span className={`severity ${finding.severity}`}>{finding.severity}</span>
                        <span className="confidence">Confidence: {finding.confidence}</span>
                      </div>
                      <p className="finding-description">{finding.description}</p>
                      <TraceList title="Evidence" traces={finding.evidence} />
                      <AssumptionList assumptions={finding.assumptions} />
                      {finding.affectedPlayerIds.length > 0 ? (
                        <p className="affected">
                          Affected players: {finding.affectedPlayerIds.join(", ")}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </section>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function DashboardPanel({
  dashboard,
  status
}: {
  dashboard: ClubDashboard | null;
  status: "idle" | "loading" | "ready" | "error";
}) {
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
    return (
      <section className="panel dashboard-empty">
        <div>
          <p className="eyebrow">Club Dashboard</p>
          <h2>No active club yet</h2>
          <p className="muted">
            Import a player snapshot to create the club profile, observed settings and historical
            baseline.
          </p>
        </div>
        <ModuleGrid
          areas={[
            {
              key: "diagnostic",
              label: "Diagnostico",
              status: "ready",
              summary: "Listo cuando exista un snapshot de plantilla."
            },
            {
              key: "history",
              label: "Analisis historico",
              status: "ready",
              summary: "Requiere al menos dos snapshots del club."
            },
            {
              key: "economy",
              label: "Economia",
              status: "planned",
              summary: "Acceso futuro; modulo no implementado todavia."
            },
            {
              key: "training",
              label: "Entrenamiento",
              status: "planned",
              summary: "Acceso futuro; modulo no implementado todavia."
            }
          ]}
        />
      </section>
    );
  }

  return (
    <section className="dashboard-grid">
      <section className="panel club-profile-panel">
        <div className="panel-heading">
          <p className="eyebrow">Club Profile</p>
          <h2>{dashboard.club.profile.name}</h2>
        </div>
        <dl className="source-list">
          <SourcedItem
            label="Observed name"
            value={dashboard.club.observed.name}
            source="observed"
          />
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
            <SourcedItem
              label="Week"
              value={dashboard.settings.effective.week}
              source="effective"
            />
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
          <SummaryItem label="Comparison" value={dashboard.snapshots.canCompare ? "Ready" : "Needs history"} />
        </dl>
        {dashboard.snapshots.latest ? (
          <p className="muted">
            Latest import: {formatDateTime(dashboard.snapshots.latest.importedAt)}.
          </p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Access</p>
          <h2>Operational areas</h2>
        </div>
        <ModuleGrid areas={dashboard.operationalAreas} />
      </section>
    </section>
  );
}

function ModuleGrid({ areas }: { areas: OperationalArea[] }) {
  return (
    <div className="module-grid">
      {areas.map((area) => (
        <article className={`module-card ${area.status}`} key={area.key}>
          <div className="module-card-heading">
            <h3>{area.label}</h3>
            <span className={`module-status ${area.status}`}>{area.status}</span>
          </div>
          <p>{area.summary}</p>
        </article>
      ))}
    </div>
  );
}

function SourcedItem({
  label,
  value,
  source
}: {
  label: string;
  value: string | number | null;
  source: SourceKind;
}) {
  return (
    <div className="source-item">
      <dt>
        {label}
        <span className={`trace-kind ${source}`}>{source}</span>
      </dt>
      <dd>{formatNullable(value)}</dd>
    </div>
  );
}

function PreferenceItem({
  label,
  manual,
  effective
}: {
  label: string;
  manual: string | undefined;
  effective: string;
}) {
  return (
    <div className="preference-item">
      <div>
        <span>{label}</span>
        <strong>{formatLabel(effective)}</strong>
      </div>
      <span className={`trace-kind ${manual ? "manual" : "effective"}`}>
        {manual ? "manual" : "effective"}
      </span>
    </div>
  );
}

async function readImportResponse(response: Response): Promise<ImportResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return createEndpointError(
      "The import API returned an empty response. Check that the API server and MongoDB connection are running."
    );
  }

  try {
    const parsed = JSON.parse(text) as Partial<ImportResponse>;

    if (!parsed.importResult) {
      return createEndpointError(`The import API returned an unexpected response with HTTP ${response.status}.`);
    }

    return parsed as ImportResponse;
  } catch {
    return createEndpointError(`The import API returned a non-JSON response with HTTP ${response.status}.`);
  }
}

function createEndpointError(message: string): ImportResponse {
  return {
    importResult: {
      status: "rejected",
      errors: [{ path: "api", message }],
      warnings: [],
      clubId: null,
      importedPlayerCount: 0
    },
    summary: null,
    diagnostic: null
  };
}

function SummaryPanel({ summary }: { summary: SquadSummary }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Imported Data</p>
        <h2>Squad summary</h2>
      </div>
      <dl className="summary-grid">
        <SummaryItem label="Club" value={summary.club} />
        <SummaryItem label="Snapshot date" value={summary.snapshotDate} />
        <SummaryItem label="Players" value={summary.playerCount.toString()} />
        <SummaryItem
          label="Total estimated value"
          value={formatMoney(summary.totalEstimatedValue)}
        />
        <SummaryItem label="Total wage" value={formatMoney(summary.totalWage)} />
        <SummaryItem label="Incomplete players" value={summary.incompletePlayerCount.toString()} />
      </dl>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function IssuePanel({
  title,
  tone,
  issues
}: {
  title: string;
  tone: "error" | "warning";
  issues: ImportIssue[];
}) {
  return (
    <section className={`panel issue-panel ${tone}`}>
      <div className="panel-heading">
        <p className="eyebrow">{tone === "error" ? "Import Errors" : "Import Warnings"}</p>
        <h2>{title}</h2>
      </div>
      <ul className="issue-list">
        {issues.map((issue) => (
          <li key={`${issue.path}-${issue.message}`}>
            <code>{issue.path}</code>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TraceList({ title, traces }: { title: string; traces: DiagnosticTrace[] }) {
  return (
    <div className="detail-block">
      <h4>{title}</h4>
      <ul>
        {traces.map((trace) => (
          <li key={`${trace.kind}-${trace.label}-${trace.value}`}>
            <span className={`trace-kind ${trace.kind}`}>{trace.kind}</span>
            <span>
              {trace.label}
              {trace.value !== null ? `: ${trace.value}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssumptionList({ assumptions }: { assumptions: DiagnosticAssumption[] }) {
  return (
    <div className="detail-block">
      <h4>Assumptions</h4>
      <ul>
        {assumptions.map((assumption) => (
          <li key={assumption.code}>
            <span className="trace-kind assumed">{assumption.traceKind}</span>
            <span>{assumption.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatMoney(total: MoneyTotal): string {
  const value = `${total.currency ?? "mixed"} ${total.amount.toLocaleString("en-US")}`;
  return total.isComplete ? value : `${value} (incomplete)`;
}

function formatNullable(value: string | number | null): string {
  return value === null || value === "" ? "Not set" : value.toString();
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatLabel(value: string): string {
  return value
    .split(/[-.]/)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

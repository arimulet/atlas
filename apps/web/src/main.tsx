import React, { useCallback, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ImportStatus = "idle" | "loading" | "success" | "error";

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
    importedPlayerCount: number;
  };
  summary: SquadSummary | null;
  diagnostic: {
    findings: DiagnosticFinding[];
  } | null;
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState("Awaiting a player snapshot JSON file.");
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

  const importFile = useCallback(async (file: File) => {
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
  }, []);

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">ATLAS</p>
            <h1>Player diagnosis</h1>
          </div>
          <div className={`status-pill ${status}`}>{message}</div>
        </header>

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
            <h2>Import snapshot JSON</h2>
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

function formatLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

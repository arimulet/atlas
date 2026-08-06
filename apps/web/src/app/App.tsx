import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchClubDashboard,
  fetchPlayerDevelopment,
  fetchSquadMarketPlanning,
  fetchSquadEconomy,
  importPlayerSnapshot
} from "./api";
import { DashboardPanel } from "./components/DashboardPanel";
import { DiagnosticPanel } from "./components/DiagnosticPanel";
import { IssuePanel } from "./components/IssuePanel";
import { PlayerDevelopmentPanel } from "./components/PlayerDevelopmentPanel";
import { SquadMarketPlanningPanel } from "./components/SquadMarketPlanningPanel";
import { SquadEconomyPanel } from "./components/SquadEconomyPanel";
import { SummaryPanel } from "./components/SummaryPanel";
import type {
  ClubDashboard,
  DashboardStatus,
  DiagnosticFinding,
  ImportIssue,
  ImportResponse,
  ImportStatus,
  PlayerDevelopment,
  SquadEconomy,
  SquadMarketPlanning
} from "./types";

const lastClubStorageKey = "atlas.lastClubId";

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeClubId, setActiveClubId] = useState<string | null>(() =>
    window.localStorage.getItem(lastClubStorageKey)
  );
  const [dashboardStatus, setDashboardStatus] = useState<DashboardStatus>(
    activeClubId ? "loading" : "idle"
  );
  const [dashboard, setDashboard] = useState<ClubDashboard | null>(null);
  const [activeView, setActiveView] = useState<
    "dashboard" | "squad-economy" | "player-development" | "squad-market-planning"
  >("dashboard");
  const [squadEconomyStatus, setSquadEconomyStatus] = useState<DashboardStatus>("idle");
  const [squadEconomy, setSquadEconomy] = useState<SquadEconomy | null>(null);
  const [playerDevelopmentStatus, setPlayerDevelopmentStatus] = useState<DashboardStatus>("idle");
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);
  const [squadMarketPlanningStatus, setSquadMarketPlanningStatus] =
    useState<DashboardStatus>("idle");
  const [squadMarketPlanning, setSquadMarketPlanning] = useState<SquadMarketPlanning | null>(null);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState("Club dashboard ready.");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [errors, setErrors] = useState<ImportIssue[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const findingsByCategory = useMemo(() => groupFindingsByCategory(result), [result]);

  const loadDashboard = useCallback(async (clubId: string) => {
    setDashboardStatus("loading");

    try {
      setDashboard(await fetchClubDashboard(clubId));
      setDashboardStatus("ready");
    } catch {
      setDashboard(null);
      setDashboardStatus("error");
    }
  }, []);

  const openSquadEconomy = useCallback(async () => {
    if (!activeClubId) {
      return;
    }

    setActiveView("squad-economy");
    setSquadEconomyStatus("loading");

    try {
      setSquadEconomy(await fetchSquadEconomy(activeClubId));
      setSquadEconomyStatus("ready");
    } catch {
      setSquadEconomy(null);
      setSquadEconomyStatus("error");
    }
  }, [activeClubId]);

  const openPlayerDevelopment = useCallback(async () => {
    if (!activeClubId) {
      return;
    }

    setActiveView("player-development");
    setPlayerDevelopmentStatus("loading");

    try {
      setPlayerDevelopment(await fetchPlayerDevelopment(activeClubId));
      setPlayerDevelopmentStatus("ready");
    } catch {
      setPlayerDevelopment(null);
      setPlayerDevelopmentStatus("error");
    }
  }, [activeClubId]);

  const openSquadMarketPlanning = useCallback(async () => {
    if (!activeClubId) {
      return;
    }

    setActiveView("squad-market-planning");
    setSquadMarketPlanningStatus("loading");

    try {
      setSquadMarketPlanning(await fetchSquadMarketPlanning(activeClubId));
      setSquadMarketPlanningStatus("ready");
    } catch {
      setSquadMarketPlanning(null);
      setSquadMarketPlanningStatus("error");
    }
  }, [activeClubId]);

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
        const { response, body } = await importPlayerSnapshot(payload);

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

        {activeView === "squad-economy" ? (
          <SquadEconomyPanel
            squadEconomy={squadEconomy}
            status={squadEconomyStatus}
            onBack={() => setActiveView("dashboard")}
          />
        ) : activeView === "player-development" ? (
          <PlayerDevelopmentPanel
            playerDevelopment={playerDevelopment}
            status={playerDevelopmentStatus}
            onBack={() => setActiveView("dashboard")}
          />
        ) : activeView === "squad-market-planning" ? (
          <SquadMarketPlanningPanel
            squadMarketPlanning={squadMarketPlanning}
            status={squadMarketPlanningStatus}
            onBack={() => setActiveView("dashboard")}
          />
        ) : (
          <DashboardPanel
            dashboard={dashboard}
            status={dashboardStatus}
            onOpenSquadEconomy={() => void openSquadEconomy()}
            onOpenPlayerDevelopment={() => void openPlayerDevelopment()}
            onOpenSquadMarketPlanning={() => void openSquadMarketPlanning()}
          />
        )}

        {activeView === "dashboard" ? (
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
        ) : null}

        {activeView === "dashboard" && status === "loading" ? (
          <p className="loading">Processing import...</p>
        ) : null}

        {activeView === "dashboard" && errors.length > 0 ? (
          <IssuePanel title="Blocking errors" tone="error" issues={errors} />
        ) : null}

        {activeView === "dashboard" && result?.importResult.warnings.length ? (
          <IssuePanel title="Warnings" tone="warning" issues={result.importResult.warnings} />
        ) : null}

        {activeView === "dashboard" && result?.summary ? (
          <SummaryPanel summary={result.summary} />
        ) : null}

        {activeView === "dashboard" ? (
          <DiagnosticPanel findingsByCategory={findingsByCategory} />
        ) : null}
      </section>
    </main>
  );
}

function groupFindingsByCategory(
  result: ImportResponse | null
): Array<[string, DiagnosticFinding[]]> {
  const groups = new Map<string, DiagnosticFinding[]>();

  result?.diagnostic?.findings.forEach((finding) => {
    groups.set(finding.category, [...(groups.get(finding.category) ?? []), finding]);
  });

  return [...groups.entries()];
}

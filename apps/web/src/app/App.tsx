import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchClubDashboard,
  fetchPlayerDevelopment,
  fetchRealYouthAcademyPlanning,
  fetchSquadMarketPlanning,
  fetchSquadEconomy,
  fetchYouthPipelinePlanning,
  syncSokkerXml
} from "@atlas/web/app/api";
import { DashboardPanel } from "@atlas/web/app/components/DashboardPanel";
import { DiagnosticPanel } from "@atlas/web/app/components/DiagnosticPanel";
import { PlayerDevelopmentPanel } from "@atlas/web/app/components/PlayerDevelopmentPanel";
import { SquadMarketPlanningPanel } from "@atlas/web/app/components/SquadMarketPlanningPanel";
import { SquadEconomyPanel } from "@atlas/web/app/components/SquadEconomyPanel";
import { SummaryPanel } from "@atlas/web/app/components/SummaryPanel";
import { YouthPipelinePlanningPanel } from "@atlas/web/app/components/YouthPipelinePlanningPanel";
import { YouthAcademyPlanningPanel } from "@atlas/web/app/components/YouthAcademyPlanningPanel";
import type {
  ClubDashboard,
  DashboardStatus,
  DiagnosticFinding,
  ImportIssue,
  ImportResponse,
  ImportStatus,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  SquadEconomy,
  SquadMarketPlanning,
  YouthPipelinePlanning
} from "./types";
import { Section } from "./components/Section";
import { IssueList } from "./components/IssueList";
import { SokkerSyncModal } from "./components/SokkerSyncModal";

const lastClubStorageKey = "atlas.lastClubId";

export function App() {

  const [activeClubId, setActiveClubId] = useState<string | null>(() =>
    window.localStorage.getItem(lastClubStorageKey)
  );
  const [dashboardStatus, setDashboardStatus] = useState<DashboardStatus>(
    activeClubId ? "loading" : "idle"
  );
  const [dashboard, setDashboard] = useState<ClubDashboard | null>(null);
  const [activeView, setActiveView] = useState<
    | "dashboard"
    | "squad-economy"
    | "player-development"
    | "squad-market-planning"
    | "youth-pipeline-planning"
    | "real-youth-academy"
  >("dashboard");
  const [squadEconomyStatus, setSquadEconomyStatus] = useState<DashboardStatus>("idle");
  const [squadEconomy, setSquadEconomy] = useState<SquadEconomy | null>(null);
  const [playerDevelopmentStatus, setPlayerDevelopmentStatus] = useState<DashboardStatus>("idle");
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);
  const [squadMarketPlanningStatus, setSquadMarketPlanningStatus] =
    useState<DashboardStatus>("idle");
  const [squadMarketPlanning, setSquadMarketPlanning] = useState<SquadMarketPlanning | null>(null);
  const [youthPipelinePlanningStatus, setYouthPipelinePlanningStatus] =
    useState<DashboardStatus>("idle");
  const [youthPipelinePlanning, setYouthPipelinePlanning] = useState<YouthPipelinePlanning | null>(
    null
  );
  const [realYouthAcademyStatus, setRealYouthAcademyStatus] = useState<DashboardStatus>("idle");
  const [realYouthAcademy, setRealYouthAcademy] = useState<RealYouthAcademyPlanning | null>(null);

  const [status, setStatus] = useState<ImportStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState("Club dashboard ready.");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [errors, setErrors] = useState<ImportIssue[]>([]);

  const [isSokkerModalOpen, setIsSokkerModalOpen] = useState(false);

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

  const openYouthPipelinePlanning = useCallback(async () => {
    if (!activeClubId) {
      return;
    }

    setActiveView("youth-pipeline-planning");
    setYouthPipelinePlanningStatus("loading");

    try {
      setYouthPipelinePlanning(await fetchYouthPipelinePlanning(activeClubId));
      setYouthPipelinePlanningStatus("ready");
    } catch {
      setYouthPipelinePlanning(null);
      setYouthPipelinePlanningStatus("error");
    }
  }, [activeClubId]);

  const openRealYouthAcademy = useCallback(async () => {
    if (!activeClubId) {
      return;
    }

    setActiveView("real-youth-academy");
    setRealYouthAcademyStatus("loading");

    try {
      setRealYouthAcademy(await fetchRealYouthAcademyPlanning(activeClubId));
      setRealYouthAcademyStatus("ready");
    } catch {
      setRealYouthAcademy(null);
      setRealYouthAcademyStatus("error");
    }
  }, [activeClubId]);

  useEffect(() => {
    if (activeClubId) {
      void loadDashboard(activeClubId);
    }
  }, [activeClubId, loadDashboard]);



  const handleSokkerSync = useCallback(
    async (login: string, pass: string) => {
      setStatus("loading");
      setFileName(null);
      setMessage("Sincronizando con Sokker XML...");
      setResult(null);
      setErrors([]);

      try {
        const { response, body } = await syncSokkerXml({ login, password: pass });

        if (!response.ok || body.importResult.status === "rejected") {
          setStatus("error");
          setMessage("Sincronización rechazada.");
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
            ? "Sincronización completada con advertencias."
            : "Sincronización completada exitosamente."
        );
        setResult(body);
        setIsSokkerModalOpen(false);
      } catch (error) {
        setStatus("error");
        setMessage("Error de conexión al sincronizar.");
        setErrors([
          {
            path: "api",
            message: error instanceof Error ? error.message : "Unknown sync error."
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
        ) : activeView === "youth-pipeline-planning" ? (
          <YouthPipelinePlanningPanel
            youthPipelinePlanning={youthPipelinePlanning}
            status={youthPipelinePlanningStatus}
            onBack={() => setActiveView("dashboard")}
          />
        ) : activeView === "real-youth-academy" ? (
          <YouthAcademyPlanningPanel
            realYouthAcademyPlanning={realYouthAcademy}
            status={realYouthAcademyStatus}
            onBack={() => setActiveView("dashboard")}
          />
        ) : (
          <DashboardPanel
            dashboard={dashboard}
            status={dashboardStatus}
            onOpenSquadEconomy={() => void openSquadEconomy()}
            onOpenPlayerDevelopment={() => void openPlayerDevelopment()}
            onOpenSquadMarketPlanning={() => void openSquadMarketPlanning()}
            onOpenYouthPipelinePlanning={() => void openYouthPipelinePlanning()}
            onOpenRealYouthAcademy={() => void openRealYouthAcademy()}
          />
        )}



        {activeView === "dashboard" ? (
          <section className="dropzone" style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderStyle: "solid" }}>
            <div>
              <p className="eyebrow">Integración Oficial</p>
              <h2>Sincronización Sokker XML</h2>
              <p>Conecta directamente con Sokker para descargar tus juveniles, profesionales y estado económico en tiempo real.</p>
            </div>
            <button type="button" onClick={() => setIsSokkerModalOpen(true)} style={{ background: "var(--accent-color, #007bff)", color: "#fff", border: "none" }}>
              Iniciar Sincronización
            </button>
          </section>
        ) : null}

        {activeView === "dashboard" && status === "loading" ? (
          <p className="loading">Processing import...</p>
        ) : null}

        {activeView === "dashboard" && errors.length > 0 ? (
          <Section title="Blocking errors" tone="error">
            <IssueList
              issues={errors.map((error) => ({ code: error.path, message: error.message }))}
            />
          </Section>
        ) : null}

        {activeView === "dashboard" && result?.importResult.warnings.length ? (
          <Section title="Warnings" tone="warning">
            <IssueList
              issues={result.importResult.warnings.map((warning) => ({
                code: warning.path,
                message: warning.message
              }))}
            />
          </Section>
        ) : null}

        {activeView === "dashboard" && result?.summary ? (
          <SummaryPanel summary={result.summary} />
        ) : null}

        {activeView === "dashboard" ? (
          <DiagnosticPanel findingsByCategory={findingsByCategory} />
        ) : null}

        <SokkerSyncModal 
          isOpen={isSokkerModalOpen}
          onClose={() => setIsSokkerModalOpen(false)}
          onSync={handleSokkerSync}
          isLoading={status === "loading"}
        />
      </section>
    </main>
  );
}

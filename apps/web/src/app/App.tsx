import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchClubDashboard,
  fetchPlayerDevelopment,
  fetchRealYouthAcademyPlanning,
  fetchSquadDepthAnalysis,
  fetchSquadPlanning,
  fetchSquadPlanningRecommendations,
  fetchYouthPipelinePlanning,
  fetchTrainingPageData,
  resetSquadRoleAssignment,
  saveSquadRoleAssignment,
  syncSokker
} from "@atlas/web/app/api";
import type {
  ClubDashboard,
  DashboardStatus,
  ImportResponse,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  SquadPlanningBundle,
  SquadRole,
  TrainingPageData,
  YouthPipelinePlanning
} from "@atlas/web/app/types";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Finances } from "./pages/Finances";
import { Squad } from "./pages/Squad";
import { Training } from "./pages/Training";
import { PlayerDetail } from "./pages/PlayerDetail";
import { Youth } from "./pages/Youth";
import { Diagnostics } from "./pages/Diagnostics";
import { createPlayerTrainingProjectionSummaries } from "./view-models/player-detail-view-model";
import type { SokkerImportCredentials } from "./components/SokkerImporterForm/types";
import type { ViewId } from "./types";
import { pathForMainView, pathForPlayerDetail, useRouter } from "./routing";

const lastClubStorageKey = "atlas.lastClubId";

export function App() {
  const { goBack, navigate, route } = useRouter();
  const activeView: ViewId = route.kind === "player-detail" ? "player-detail" : route.view;
  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [activeClubId, setActiveClubId] = useState<string | null>(() =>
    window.localStorage.getItem(lastClubStorageKey)
  );
  const [dashboardStatus, setDashboardStatus] = useState<DashboardStatus>(
    activeClubId ? "loading" : "idle"
  );
  const [dashboard, setDashboard] = useState<ClubDashboard | null>(null);
  const [youthStatus, setYouthStatus] = useState<DashboardStatus>(
    activeClubId ? "loading" : "idle"
  );
  const [youthAcademy, setYouthAcademy] = useState<RealYouthAcademyPlanning | null>(null);
  const [youthPipelineStatus, setYouthPipelineStatus] = useState<DashboardStatus>(
    activeClubId ? "loading" : "idle"
  );
  const [youthPipeline, setYouthPipeline] = useState<YouthPipelinePlanning | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<DashboardStatus>(
    activeClubId ? "loading" : "idle"
  );
  const [training, setTraining] = useState<TrainingPageData | null>(null);
  const [trainingDiagnostic, setTrainingDiagnostic] = useState<ImportResponse["diagnostic"]>(null);
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);
  const [squadPlanningStatus, setSquadPlanningStatus] = useState<DashboardStatus>(
    activeClubId ? "loading" : "idle"
  );
  const [squadPlanning, setSquadPlanning] = useState<SquadPlanningBundle | null>(null);
  const projectionSummaries = useMemo(
    () =>
      trainingStatus === "ready"
        ? createPlayerTrainingProjectionSummaries({
            development: playerDevelopment,
            training,
            trainingDiagnostic,
            trainingStatus
          })
        : undefined,
    [playerDevelopment, training, trainingDiagnostic, trainingStatus]
  );

  const loadDashboard = useCallback(async (clubId: string): Promise<boolean> => {
    setDashboardStatus("loading");

    try {
      setDashboard(await fetchClubDashboard(clubId));
      setDashboardStatus("ready");
      return true;
    } catch {
      setDashboard(null);
      setDashboardStatus("error");
      return false;
    }
  }, []);

  const loadYouthAcademy = useCallback(async (clubId: string): Promise<boolean> => {
    setYouthStatus("loading");

    try {
      setYouthAcademy(await fetchRealYouthAcademyPlanning(clubId));
      setYouthStatus("ready");
      return true;
    } catch {
      setYouthAcademy(null);
      setYouthStatus("error");
      return false;
    }
  }, []);

  const loadTraining = useCallback(async (clubId: string): Promise<boolean> => {
    setTrainingStatus("loading");

    try {
      setTraining(await fetchTrainingPageData(clubId));
      setTrainingStatus("ready");
      return true;
    } catch {
      setTraining(null);
      setTrainingStatus("error");
      return false;
    }
  }, []);

  const loadPlayerDevelopment = useCallback(async (clubId: string): Promise<boolean> => {
    try {
      setPlayerDevelopment(await fetchPlayerDevelopment(clubId));
      return true;
    } catch {
      setPlayerDevelopment(null);
      return false;
    }
  }, []);

  const loadSquadPlanning = useCallback(async (clubId: string): Promise<boolean> => {
    setSquadPlanningStatus("loading");

    try {
      const [assessment, depth, recommendations] = await Promise.all([
        fetchSquadPlanning(clubId),
        fetchSquadDepthAnalysis(clubId),
        fetchSquadPlanningRecommendations(clubId)
      ]);

      setSquadPlanning({ assessment, depth, recommendations });
      setSquadPlanningStatus("ready");
      return true;
    } catch {
      setSquadPlanning(null);
      setSquadPlanningStatus("error");
      return false;
    }
  }, []);

  const loadYouthPipeline = useCallback(async (clubId: string): Promise<boolean> => {
    setYouthPipelineStatus("loading");

    try {
      setYouthPipeline(await fetchYouthPipelinePlanning(clubId));
      setYouthPipelineStatus("ready");
      return true;
    } catch {
      setYouthPipeline(null);
      setYouthPipelineStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!activeClubId) {
      return;
    }

    void loadDashboard(activeClubId);
    void loadYouthAcademy(activeClubId);
    void loadTraining(activeClubId);
    void loadPlayerDevelopment(activeClubId);
    void loadYouthPipeline(activeClubId);
    void loadSquadPlanning(activeClubId);
  }, [
    activeClubId,
    loadDashboard,
    loadPlayerDevelopment,
    loadTraining,
    loadYouthAcademy,
    loadYouthPipeline,
    loadSquadPlanning
  ]);

  const handleSokkerImport = useCallback(
    async (credentials: SokkerImportCredentials) => {
      const { response, body } = await syncSokker(credentials);

      if (!response.ok || body.importResult.status === "rejected") {
        const message = body.importResult.errors
          .map((error) => (error.path ? `${error.path}: ${error.message}` : error.message))
          .join(" ");

        throw new Error(message || "No se pudieron actualizar los datos.");
      }

      if (body.importResult.clubId) {
        window.localStorage.setItem(lastClubStorageKey, body.importResult.clubId);
        setActiveClubId(body.importResult.clubId);
        const [
          dashboardLoaded,
          youthLoaded,
          trainingLoaded,
          developmentLoaded,
          youthPipelineLoaded
        ] = await Promise.all([
          loadDashboard(body.importResult.clubId),
          loadYouthAcademy(body.importResult.clubId),
          loadTraining(body.importResult.clubId),
          loadPlayerDevelopment(body.importResult.clubId),
          loadYouthPipeline(body.importResult.clubId)
        ]);

        setTrainingDiagnostic(body.diagnostic);

        if (
          !dashboardLoaded ||
          !youthLoaded ||
          !trainingLoaded ||
          !developmentLoaded ||
          !youthPipelineLoaded
        ) {
          throw new Error("Datos actualizados, pero no se pudo recargar el Dashboard.");
        }

        void loadSquadPlanning(body.importResult.clubId);
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [
      loadDashboard,
      loadPlayerDevelopment,
      loadSquadPlanning,
      loadTraining,
      loadYouthAcademy,
      loadYouthPipeline
    ]
  );

  const handleSaveSquadRole = useCallback(
    async (playerId: string, role: SquadRole | null): Promise<void> => {
      if (!activeClubId) {
        return;
      }

      if (role === null) {
        await resetSquadRoleAssignment(activeClubId, playerId);
      } else {
        await saveSquadRoleAssignment(activeClubId, playerId, role);
      }

      await loadSquadPlanning(activeClubId);
    },
    [activeClubId, loadSquadPlanning]
  );

  const handleSelectPlayer = useCallback(
    (playerId: string) => {
      navigate(pathForPlayerDetail(playerId));
    },
    [navigate]
  );

  const handleBackFromPlayerDetail = useCallback(() => {
    goBack(pathForMainView("squad"));
  }, [goBack]);

  return (
    <AppShell
      activeView={route.kind === "main" ? route.view : null}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey={route.path}
      onViewChange={(view) => navigate(pathForMainView(view))}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      {activeView === "dashboard" ? (
        <Dashboard
          dashboard={dashboard}
          dashboardStatus={dashboardStatus}
          onSelectPlayer={handleSelectPlayer}
          youthAcademy={youthAcademy}
          youthStatus={youthStatus}
        />
      ) : activeView === "finances" ? (
        <Finances status={dashboardStatus} />
      ) : activeView === "squad" ? (
          <Squad
            development={playerDevelopment}
          onSelectPlayer={handleSelectPlayer}
          onSaveSquadRole={handleSaveSquadRole}
          projectionSummaries={projectionSummaries}
          squadPlanning={squadPlanning}
          squadPlanningStatus={squadPlanningStatus}
          training={training}
          trainingDiagnostic={trainingDiagnostic}
          trainingStatus={trainingStatus}
        />
      ) : activeView === "training" ? (
        <Training
          clubId={activeClubId}
          development={playerDevelopment}
          onSelectPlayer={handleSelectPlayer}
          projectionSummaries={projectionSummaries}
          training={training}
          trainingDiagnostic={trainingDiagnostic}
          trainingStatus={trainingStatus}
        />
      ) : activeView === "youth" ? (
        <Youth youthAcademy={youthAcademy} youthStatus={youthStatus} />
      ) : activeView === "diagnostics" ? (
        <Diagnostics
          dashboardStatus={dashboardStatus}
          development={playerDevelopment}
          onSelectPlayer={handleSelectPlayer}
          training={training}
          trainingDiagnostic={trainingDiagnostic}
          trainingStatus={trainingStatus}
          youthAcademy={youthAcademy}
          youthPipeline={youthPipeline}
          youthPipelineStatus={youthPipelineStatus}
          youthStatus={youthStatus}
        />
      ) : activeView === "player-detail" ? (
        <PlayerDetail
          clubId={activeClubId}
          development={playerDevelopment}
          onBack={handleBackFromPlayerDetail}
          onBackToSquad={() => navigate(pathForMainView("squad"), { replace: true })}
          playerId={route.kind === "player-detail" ? route.playerId : ""}
          training={training}
          trainingDiagnostic={trainingDiagnostic}
          trainingStatus={trainingStatus}
        />
      ) : (
        <div className="atlas-placeholder">
          <span className="atlas-placeholder__eyebrow">ATLAS</span>
          <h1>Módulo en preparación</h1>
          <p>
            La navegación ya está preparada; el contenido funcional se migrará en una siguiente
            etapa.
          </p>
          <div className="atlas-placeholder__section">
            <span>Sección seleccionada</span>
            <strong>{activeView}</strong>
          </div>
        </div>
      )}
    </AppShell>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchClubDashboard,
  fetchPlayerDevelopment,
  fetchRealYouthAcademyPlanning,
  fetchYouthPipelinePlanning,
  fetchTrainingPageData,
  syncSokkerXml
} from "@atlas/web/app/api";
import type {
  ClubDashboard,
  DashboardStatus,
  ImportResponse,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  TrainingPageData,
  YouthPipelinePlanning
} from "@atlas/web/app/types";
import { AppShell } from "../components/AppShell";
import { DashboardV2 } from "../pages/DashboardV2";
import { FinancesV2 } from "../pages/FinancesV2";
import { SquadV2 } from "../pages/SquadV2";
import { TrainingV2 } from "../pages/TrainingV2";
import { PlayerDetailV2 } from "../pages/PlayerDetailV2";
import { YouthV2 } from "../pages/YouthV2";
import { DiagnosticsV2 } from "../pages/DiagnosticsV2";
import { createPlayerTrainingProjectionSummaries } from "../view-models/player-detail-view-model";
import type { SokkerImportCredentials } from "../components/SokkerImporterForm/types";
import type { V2ViewId } from "../types";
import { pathForMainView, pathForPlayerDetail, useV2Router } from "../routing";
import type { AppV2Props } from "./types";

const lastClubStorageKey = "atlas.lastClubId";

export function AppV2({ uiVersion, onUiVersionChange }: AppV2Props) {
  const { goBack, navigate, route } = useV2Router();
  const activeView: V2ViewId = route.kind === "player-detail" ? "player-detail" : route.view;
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
  }, [
    activeClubId,
    loadDashboard,
    loadPlayerDevelopment,
    loadTraining,
    loadYouthAcademy,
    loadYouthPipeline
  ]);

  const handleSokkerImport = useCallback(
    async (credentials: SokkerImportCredentials) => {
      const { response, body } = await syncSokkerXml(credentials);

      if (!response.ok || body.importResult.status === "rejected") {
        const message = body.importResult.errors.map((error) => error.message).join(" ");

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
          loadYouthPipeline(body.importResult.clubId),
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

        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [
      loadDashboard,
      loadPlayerDevelopment,
      loadTraining,
      loadYouthAcademy,
      loadYouthPipeline
    ]
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
      uiVersion={uiVersion}
      onUiVersionChange={onUiVersionChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      {activeView === "dashboard" ? (
        <DashboardV2
          dashboard={dashboard}
          dashboardStatus={dashboardStatus}
          onSelectPlayer={handleSelectPlayer}
          youthAcademy={youthAcademy}
          youthStatus={youthStatus}
        />
      ) : activeView === "finances" ? (
        <FinancesV2 status={dashboardStatus} />
      ) : activeView === "squad" ? (
        <SquadV2
          development={playerDevelopment}
          onSelectPlayer={handleSelectPlayer}
          projectionSummaries={projectionSummaries}
          training={training}
          trainingDiagnostic={trainingDiagnostic}
          trainingStatus={trainingStatus}
        />
      ) : activeView === "training" ? (
        <TrainingV2
          development={playerDevelopment}
          onSelectPlayer={handleSelectPlayer}
          projectionSummaries={projectionSummaries}
          training={training}
          trainingDiagnostic={trainingDiagnostic}
          trainingStatus={trainingStatus}
        />
      ) : activeView === "youth" ? (
        <YouthV2 youthAcademy={youthAcademy} youthStatus={youthStatus} />
      ) : activeView === "diagnostics" ? (
        <DiagnosticsV2
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
        <PlayerDetailV2
          development={playerDevelopment}
          onBack={handleBackFromPlayerDetail}
          onBackToSquad={() => navigate(pathForMainView("squad"), { replace: true })}
          playerId={route.kind === "player-detail" ? route.playerId : ""}
          training={training}
          trainingDiagnostic={trainingDiagnostic}
          trainingStatus={trainingStatus}
        />
      ) : (
        <div className="v2-placeholder">
          <span className="v2-placeholder__eyebrow">ATLAS UI V2</span>
          <h1>Módulo en preparación</h1>
          <p>
            La navegación ya está preparada; el contenido funcional se migrará en una siguiente
            etapa.
          </p>
          <div className="v2-placeholder__section">
            <span>Sección seleccionada</span>
            <strong>{activeView}</strong>
          </div>
        </div>
      )}
    </AppShell>
  );
}

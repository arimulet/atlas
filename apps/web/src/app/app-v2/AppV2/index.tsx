import { useCallback, useEffect, useState } from "react";

import {
  fetchClubDashboard,
  fetchPlayerDevelopment,
  fetchRealYouthAcademyPlanning,
  fetchTrainingPageData,
  syncSokkerXml
} from "@atlas/web/app/api";
import type {
  ClubDashboard,
  DashboardStatus,
  ImportResponse,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  TrainingPageData
} from "@atlas/web/app/types";
import { AppShell } from "../components/AppShell";
import { DashboardV2 } from "../pages/DashboardV2";
import { TrainingV2 } from "../pages/TrainingV2";
import { PlayerDetailV2 } from "../pages/PlayerDetailV2";
import type { SokkerImportCredentials } from "../components/SokkerImporterForm/types";
import type { V2ViewId } from "../types";
import type { AppV2Props } from "./types";

const lastClubStorageKey = "atlas.lastClubId";

export function AppV2({ uiVersion, onUiVersionChange }: AppV2Props) {
  const [activeView, setActiveView] = useState<V2ViewId>("dashboard");
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
  const [trainingStatus, setTrainingStatus] = useState<DashboardStatus>(
    activeClubId ? "loading" : "idle"
  );
  const [training, setTraining] = useState<TrainingPageData | null>(null);
  const [trainingDiagnostic, setTrainingDiagnostic] = useState<ImportResponse["diagnostic"]>(null);
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!activeClubId) {
      return;
    }

    void loadDashboard(activeClubId);
    void loadYouthAcademy(activeClubId);
    void loadTraining(activeClubId);
    void loadPlayerDevelopment(activeClubId);
  }, [activeClubId, loadDashboard, loadPlayerDevelopment, loadTraining, loadYouthAcademy]);

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
        const [dashboardLoaded, youthLoaded, trainingLoaded, developmentLoaded] = await Promise.all(
          [
            loadDashboard(body.importResult.clubId),
            loadYouthAcademy(body.importResult.clubId),
            loadTraining(body.importResult.clubId),
            loadPlayerDevelopment(body.importResult.clubId)
          ]
        );

        setTrainingDiagnostic(body.diagnostic);

        if (!dashboardLoaded || !youthLoaded || !trainingLoaded || !developmentLoaded) {
          throw new Error("Datos actualizados, pero no se pudo recargar el Dashboard.");
        }

        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [loadDashboard, loadPlayerDevelopment, loadTraining, loadYouthAcademy]
  );

  const handleSelectPlayer = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    setActiveView("player-detail");
  }, []);

  const handleBackFromPlayerDetail = useCallback(() => {
    setActiveView("training");
  }, []);

  return (
    <AppShell
      activeView={activeView}
      isSokkerImportOpen={isSokkerImportOpen}
      onViewChange={setActiveView}
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
      ) : activeView === "training" ? (
        <TrainingV2
          onSelectPlayer={handleSelectPlayer}
          training={training}
          trainingDiagnostic={trainingDiagnostic}
          trainingStatus={trainingStatus}
        />
      ) : activeView === "player-detail" && selectedPlayerId !== null ? (
        <PlayerDetailV2
          development={playerDevelopment}
          onBack={handleBackFromPlayerDetail}
          playerId={selectedPlayerId}
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

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  fetchClubDashboard,
  fetchClubDiagnostic,
  fetchPlayerDevelopment,
  fetchRealYouthAcademyPlanning,
  fetchSquadDepthAnalysis,
  fetchSquadPlanning,
  fetchSquadPlanningRecommendations,
  fetchYouthPipelinePlanning,
  fetchTrainingPageData,
  fetchUserClubs,
  resetSquadRoleAssignment,
  saveSquadRoleAssignment
} from "../api";
import type {
  ClubDashboard,
  DashboardStatus,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  SquadPlanningBundle,
  SquadRole,
  TrainingPageData,
  YouthPipelinePlanning
} from "../types";
import type { TrainingDiagnostic } from "../view-models/training-view-model";
import type { PlayerTrainingProjectionSummary } from "../view-models/player-detail-view-model";
import { createPlayerTrainingProjectionSummaries } from "../view-models/player-detail-view-model";
import {
  useFinancialStrategy,
  type FinancialStrategyState
} from "../features/financialStrategy/useFinancialStrategy";
import { useAuth } from "./AuthContext";

const lastClubStorageKey = "atlas.lastClubId";

export interface ClubDataContextValue {
  activeClubId: string | null;
  dashboard: ClubDashboard | null;
  dashboardStatus: DashboardStatus;
  youthAcademy: RealYouthAcademyPlanning | null;
  youthStatus: DashboardStatus;
  training: TrainingPageData | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  trainingStatus: DashboardStatus;
  playerDevelopment: PlayerDevelopment | null;
  squadPlanning: SquadPlanningBundle | null;
  squadPlanningStatus: DashboardStatus;
  youthPipeline: YouthPipelinePlanning | null;
  youthPipelineStatus: DashboardStatus;
  financialStrategy: FinancialStrategyState | null;
  projectionSummaries?: ReadonlyMap<string, PlayerTrainingProjectionSummary>;
  reloadAll: () => Promise<void>;
  saveSquadRole: (playerId: string, role: SquadRole | null) => Promise<void>;
}

const ClubDataContext = createContext<ClubDataContextValue | null>(null);

export function ClubDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ClubDashboard | null>(null);
  const [dashboardStatus, setDashboardStatus] = useState<DashboardStatus>("idle");
  const [youthAcademy, setYouthAcademy] = useState<RealYouthAcademyPlanning | null>(null);
  const [youthStatus, setYouthStatus] = useState<DashboardStatus>("idle");
  const [training, setTraining] = useState<TrainingPageData | null>(null);
  const [trainingDiagnostic, setTrainingDiagnostic] = useState<TrainingDiagnostic | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<DashboardStatus>("idle");
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);
  const [squadPlanning, setSquadPlanning] = useState<SquadPlanningBundle | null>(null);
  const [squadPlanningStatus, setSquadPlanningStatus] = useState<DashboardStatus>("idle");
  const [youthPipeline, setYouthPipeline] = useState<YouthPipelinePlanning | null>(null);
  const [youthPipelineStatus, setYouthPipelineStatus] = useState<DashboardStatus>("idle");

  const financialStrategy = useFinancialStrategy({
    clubId: activeClubId,
    currency: dashboard?.club.currency ?? null,
    squadPlanning
  });

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
      const [trainingData, diagnostic] = await Promise.all([
        fetchTrainingPageData(clubId),
        fetchClubDiagnostic(clubId)
      ]);
      setTraining(trainingData);
      setTrainingDiagnostic(diagnostic);
      setTrainingStatus("ready");
      return true;
    } catch {
      setTraining(null);
      setTrainingDiagnostic(null);
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

  const loadAllClubData = useCallback(
    async (clubId: string) => {
      await Promise.all([
        loadDashboard(clubId),
        loadYouthAcademy(clubId),
        loadTraining(clubId),
        loadPlayerDevelopment(clubId),
        loadYouthPipeline(clubId),
        loadSquadPlanning(clubId)
      ]);
    },
    [
      loadDashboard,
      loadYouthAcademy,
      loadTraining,
      loadPlayerDevelopment,
      loadYouthPipeline,
      loadSquadPlanning
    ]
  );

  const reloadAll = useCallback(async () => {
    if (activeClubId) {
      await loadAllClubData(activeClubId);
    }
  }, [activeClubId, loadAllClubData]);

  const saveSquadRole = useCallback(
    async (playerId: string, role: SquadRole | null) => {
      if (!activeClubId) return;
      if (role === null) {
        await resetSquadRoleAssignment(activeClubId, playerId);
      } else {
        await saveSquadRoleAssignment(activeClubId, playerId, role);
      }
      await loadSquadPlanning(activeClubId);
    },
    [activeClubId, loadSquadPlanning]
  );

  useEffect(() => {
    if (!user) {
      setActiveClubId(null);
      return;
    }

    void (async () => {
      try {
        const token = await user.getIdToken();
        const data = await fetchUserClubs(token);
        const clubs = data?.clubs ?? [];
        if (clubs.length > 0) {
          const storedClubId =
            typeof window !== "undefined"
              ? window.localStorage.getItem(lastClubStorageKey)
              : null;
          const matched = clubs.find((c) => String(c.id) === storedClubId || String(c.clubId) === storedClubId);
          const selected = matched ?? clubs[0];
          if (selected) {
            const targetClubId = String(selected.id ?? selected.clubId);
            setActiveClubId(targetClubId);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(lastClubStorageKey, targetClubId);
            }
          }
        }
      } catch {
        // Auth fallback
      }
    })();
  }, [user]);

  useEffect(() => {
    if (activeClubId) {
      void loadAllClubData(activeClubId);
    }
  }, [activeClubId, loadAllClubData]);

  const value = useMemo(
    () => ({
      activeClubId,
      dashboard,
      dashboardStatus,
      youthAcademy,
      youthStatus,
      training,
      trainingDiagnostic,
      trainingStatus,
      playerDevelopment,
      squadPlanning,
      squadPlanningStatus,
      youthPipeline,
      youthPipelineStatus,
      financialStrategy,
      projectionSummaries,
      reloadAll,
      saveSquadRole
    }),
    [
      activeClubId,
      dashboard,
      dashboardStatus,
      youthAcademy,
      youthStatus,
      training,
      trainingDiagnostic,
      trainingStatus,
      playerDevelopment,
      squadPlanning,
      squadPlanningStatus,
      youthPipeline,
      youthPipelineStatus,
      financialStrategy,
      projectionSummaries,
      reloadAll,
      saveSquadRole
    ]
  );

  return <ClubDataContext.Provider value={value}>{children}</ClubDataContext.Provider>;
}

export function useClubData() {
  const context = useContext(ClubDataContext);
  if (!context) {
    throw new Error("useClubData must be used within a ClubDataProvider");
  }
  return context;
}

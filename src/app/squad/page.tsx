"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchClubDashboard,
  fetchClubDiagnostic,
  fetchPlayerDevelopment,
  fetchSquadDepthAnalysis,
  fetchSquadPlanning,
  fetchSquadPlanningRecommendations,
  fetchTrainingPageData,
  resetSquadRoleAssignment,
  saveSquadRoleAssignment,
  syncSokker
} from "@/api";
import type {
  DashboardStatus,
  ImportResponse,
  PlayerDevelopment,
  SquadPlanningBundle,
  SquadRole,
  TrainingPageData
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { Squad } from "@/components/Squad";
import { createPlayerTrainingProjectionSummaries } from "@/app/view-models/player-detail-view-model";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView, pathForPlayerDetail } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";

export default function SquadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [currency, setCurrency] = useState<string | null>(null);
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);
  const [squadPlanningStatus, setSquadPlanningStatus] = useState<DashboardStatus>("idle");
  const [squadPlanning, setSquadPlanning] = useState<SquadPlanningBundle | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<DashboardStatus>("idle");
  const [training, setTraining] = useState<TrainingPageData | null>(null);
  const [trainingDiagnostic, setTrainingDiagnostic] = useState<ImportResponse["diagnostic"]>(null);

  const loadSquadPlanningData = useCallback(async (): Promise<boolean> => {
    setSquadPlanningStatus("loading");
    try {
      const [assessment, depth, recommendations] = await Promise.all([
        fetchSquadPlanning(),
        fetchSquadDepthAnalysis(),
        fetchSquadPlanningRecommendations()
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

  const loadSquadData = useCallback(async () => {
    setTrainingStatus("loading");
    try {
      const [dash, dev, train, diag] = await Promise.all([
        fetchClubDashboard(),
        fetchPlayerDevelopment(),
        fetchTrainingPageData(),
        fetchClubDiagnostic()
      ]);

      setCurrency(dash.club?.currency ?? null);
      setPlayerDevelopment(dev);
      setTraining(train);
      setTrainingDiagnostic(diag);
      setTrainingStatus("ready");
    } catch {
      setCurrency(null);
      setPlayerDevelopment(null);
      setTraining(null);
      setTrainingDiagnostic(null);
      setTrainingStatus("error");
    }

    void loadSquadPlanningData();
  }, [loadSquadPlanningData]);

  useEffect(() => {
    if (!user) {
      setCurrency(null);
      setPlayerDevelopment(null);
      setSquadPlanning(null);
      setSquadPlanningStatus("idle");
      setTraining(null);
      setTrainingDiagnostic(null);
      setTrainingStatus("idle");
      return;
    }

    void loadSquadData();
  }, [user, loadSquadData]);

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

  const diagnosticAlertCount = useMemo(
    () =>
      trainingDiagnostic?.findings.filter(
        (diagnostic) => diagnostic.severity === "high" || diagnostic.severity === "medium"
      ).length ?? 0,
    [trainingDiagnostic]
  );

  const handleSaveSquadRole = useCallback(
    async (playerId: string, role: SquadRole | null): Promise<void> => {
      if (role === null) {
        await resetSquadRoleAssignment(playerId);
      } else {
        await saveSquadRoleAssignment(playerId, role);
      }

      const reloaded = await loadSquadPlanningData();
      if (!reloaded) {
        throw new Error(
          "Squad role was saved, but the updated squad planning could not be loaded."
        );
      }
    },
    [loadSquadPlanningData]
  );

  const handleSokkerImport = useCallback(
    async (credentials: SokkerImportCredentials) => {
      const token = user ? await user.getIdToken() : undefined;
      const { response, body } = await syncSokker(credentials, token);

      if (!response.ok || body.importResult.status === "rejected") {
        const message = body.importResult.errors
          .map((error) => (error.path ? `${error.path}: ${error.message}` : error.message))
          .join(" ");

        throw new Error(message || "No se pudieron actualizar los datos.");
      }

      if (body.importResult.clubId) {
        await loadSquadData();
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadSquadData]
  );

  const handleSelectPlayer = useCallback(
    (playerId: string) => {
      router.push(pathForPlayerDetail(playerId));
    },
    [router]
  );

  const handleViewChange = useCallback(
    (view: Parameters<typeof pathForMainView>[0]) => {
      router.push(pathForMainView(view));
    },
    [router]
  );

  if (authLoading) {
    return (
      <div className="atlas-auth-loading-screen">
        <span className="atlas-auth-spinner" aria-hidden="true" />
        <span>Cargando ATLAS...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <AppShell
      activeView="squad"
      diagnosticAlertCount={diagnosticAlertCount}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/squad"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <Squad
        currency={currency}
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
    </AppShell>
  );
}

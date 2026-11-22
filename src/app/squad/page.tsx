"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchClubDiagnostic,
  fetchPlayerDevelopment,
  fetchSquadPlanning,
  fetchTrainingPageData,
  fetchWeeklyTrainingIntelligence,
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
  TrainingPageData,
  WeeklyTrainingIntelligence
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { Squad } from "@/components/Squad";
import { createPlayerTrainingProjectionSummaries } from "@/app/view-models/player-detail-view-model";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView, pathForPlayerDetail } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";

export default function SquadPage() {
  const { user, loading: authLoading } = useAuth();
  const { club } = useClub();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const currency = club?.currency ?? null;
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);
  const [squadPlanningStatus, setSquadPlanningStatus] = useState<DashboardStatus>("idle");
  const [squadPlanning, setSquadPlanning] = useState<Pick<SquadPlanningBundle, "assessment"> | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<DashboardStatus>("idle");
  const [training, setTraining] = useState<TrainingPageData | null>(null);
  const [trainingDiagnostic, setTrainingDiagnostic] = useState<ImportResponse["diagnostic"]>(null);
  const [weeklyTrainingIntelligence, setWeeklyTrainingIntelligence] =
    useState<WeeklyTrainingIntelligence | null>(null);

  const loadSquadPlanningData = useCallback(async (): Promise<boolean> => {
    setSquadPlanningStatus("loading");
    try {
      const assessment = await fetchSquadPlanning();
      setSquadPlanning({ assessment });
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
    void loadSquadPlanningData();
    void fetchClubDiagnostic()
      .then((diag) => setTrainingDiagnostic(diag))
      .catch(() => setTrainingDiagnostic(null));
    void fetchWeeklyTrainingIntelligence()
      .then((intel) => setWeeklyTrainingIntelligence(intel))
      .catch(() => setWeeklyTrainingIntelligence(null));

    try {
      const [dev, train] = await Promise.all([
        fetchPlayerDevelopment(),
        fetchTrainingPageData()
      ]);

      setPlayerDevelopment(dev);
      setTraining(train);
      setTrainingStatus("ready");
    } catch {
      setPlayerDevelopment(null);
      setTraining(null);
      setTrainingDiagnostic(null);
      setWeeklyTrainingIntelligence(null);
      setTrainingStatus("error");
    }
  }, [loadSquadPlanningData]);

  useEffect(() => {
    if (!user) {
      setPlayerDevelopment(null);
      setSquadPlanning(null);
      setSquadPlanningStatus("idle");
      setTraining(null);
      setTrainingDiagnostic(null);
      setWeeklyTrainingIntelligence(null);
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
      (trainingDiagnostic?.findings ?? []).filter(
        (diagnostic) => diagnostic.severity === "high" || diagnostic.severity === "medium"
      ).length,
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

        throw new Error(message || "Failed to update data.");
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
        <span>Loading ATLAS...</span>
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
        clubId={club?.id ?? playerDevelopment?.clubId ?? null}
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
        weeklyTrainingIntelligence={weeklyTrainingIntelligence}
      />
    </AppShell>
  );
}

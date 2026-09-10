"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchClubDashboard,
  fetchClubDiagnostic,
  fetchPlayerDevelopment,
  fetchSquadDepthAnalysis,
  fetchSquadPlanning,
  fetchSquadPlanningRecommendations,
  fetchTrainingPageData,
  syncSokker
} from "@/api";
import type {
  DashboardStatus,
  ImportResponse,
  PlayerDevelopment,
  SquadPlanningBundle,
  TrainingPageData
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { PlayerDetail } from "@/components/PlayerDetail";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [currency, setCurrency] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);
  const [squadPlanning, setSquadPlanning] = useState<SquadPlanningBundle | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<DashboardStatus>("idle");
  const [training, setTraining] = useState<TrainingPageData | null>(null);
  const [trainingDiagnostic, setTrainingDiagnostic] = useState<ImportResponse["diagnostic"]>(null);

  const loadPlayerData = useCallback(async () => {
    setTrainingStatus("loading");
    try {
      const [dash, dev, train, diag, assessment, depth, recommendations] = await Promise.all([
        fetchClubDashboard(),
        fetchPlayerDevelopment(),
        fetchTrainingPageData(),
        fetchClubDiagnostic(),
        fetchSquadPlanning(),
        fetchSquadDepthAnalysis(),
        fetchSquadPlanningRecommendations()
      ]);

      setClubId(dash.club?.id ?? (dash.club?.clubId ? String(dash.club.clubId) : null));
      setCurrency(dash.club?.currency ?? null);
      setPlayerDevelopment(dev);
      setTraining(train);
      setTrainingDiagnostic(diag);
      setSquadPlanning({ assessment, depth, recommendations });
      setTrainingStatus("ready");
    } catch {
      setClubId(null);
      setCurrency(null);
      setPlayerDevelopment(null);
      setTraining(null);
      setTrainingDiagnostic(null);
      setSquadPlanning(null);
      setTrainingStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setClubId(null);
      setCurrency(null);
      setPlayerDevelopment(null);
      setTraining(null);
      setTrainingDiagnostic(null);
      setSquadPlanning(null);
      setTrainingStatus("idle");
      return;
    }

    void loadPlayerData();
  }, [user, loadPlayerData]);

  const diagnosticAlertCount = useMemo(
    () =>
      trainingDiagnostic?.findings.filter(
        (diagnostic) => diagnostic.severity === "high" || diagnostic.severity === "medium"
      ).length ?? 0,
    [trainingDiagnostic]
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
        await loadPlayerData();
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadPlayerData]
  );

  const handleViewChange = useCallback(
    (view: Parameters<typeof pathForMainView>[0]) => {
      router.push(pathForMainView(view));
    },
    [router]
  );

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(pathForMainView("squad"));
    }
  }, [router]);

  const handleBackToSquad = useCallback(() => {
    router.push(pathForMainView("squad"));
  }, [router]);

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
      activeView={null}
      diagnosticAlertCount={diagnosticAlertCount}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey={`/player/${id}`}
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <PlayerDetail
        clubId={clubId}
        currency={currency}
        development={playerDevelopment}
        onBack={handleBack}
        onBackToSquad={handleBackToSquad}
        playerId={id}
        squadPlanning={squadPlanning}
        training={training}
        trainingDiagnostic={trainingDiagnostic}
        trainingStatus={trainingStatus}
      />
    </AppShell>
  );
}

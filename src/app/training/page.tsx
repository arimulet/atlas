"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchClubDiagnostic,
  fetchPlayerDevelopment,
  fetchTrainingPageData,
  syncSokker
} from "@/api";
import type {
  DashboardStatus,
  ImportResponse,
  PlayerDevelopment,
  TrainingPageData
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { Training } from "@/components/Training";
import { createPlayerTrainingProjectionSummaries } from "@/app/view-models/player-detail-view-model";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView, pathForPlayerDetail } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";

export default function TrainingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<DashboardStatus>("idle");
  const [training, setTraining] = useState<TrainingPageData | null>(null);
  const [trainingDiagnostic, setTrainingDiagnostic] = useState<ImportResponse["diagnostic"]>(null);
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);

  const loadTrainingData = useCallback(async () => {
    setTrainingStatus("loading");
    try {
      const [trainingData, diagnostic, development] = await Promise.all([
        fetchTrainingPageData(),
        fetchClubDiagnostic(),
        fetchPlayerDevelopment()
      ]);

      setTraining(trainingData);
      setTrainingDiagnostic(diagnostic);
      setPlayerDevelopment(development);
      setTrainingStatus("ready");
      return true;
    } catch {
      setTraining(null);
      setTrainingDiagnostic(null);
      setPlayerDevelopment(null);
      setTrainingStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setTraining(null);
      setTrainingDiagnostic(null);
      setPlayerDevelopment(null);
      setTrainingStatus("idle");
      return;
    }

    void loadTrainingData();
  }, [user, loadTrainingData]);

  const clubId = playerDevelopment?.clubId ?? null;

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
        const loaded = await loadTrainingData();
        if (!loaded) {
          throw new Error("Datos actualizados, pero no se pudo recargar el entrenamiento.");
        }
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadTrainingData]
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
      activeView="training"
      diagnosticAlertCount={diagnosticAlertCount}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/training"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <Training
        clubId={clubId}
        development={playerDevelopment}
        onSelectPlayer={handleSelectPlayer}
        projectionSummaries={projectionSummaries}
        training={training}
        trainingDiagnostic={trainingDiagnostic}
        trainingStatus={trainingStatus}
      />
    </AppShell>
  );
}

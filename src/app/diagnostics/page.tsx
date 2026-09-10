"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchClubDashboard,
  fetchClubDiagnostic,
  fetchPlayerDevelopment,
  fetchRealYouthAcademyPlanning,
  fetchTrainingPageData,
  fetchYouthPipelinePlanning,
  syncSokker
} from "@/api";
import type {
  DashboardStatus,
  ImportResponse,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  TrainingPageData,
  YouthPipelinePlanning
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { Diagnostics } from "@/components/Diagnostics";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView, pathForPlayerDetail } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";

export default function DiagnosticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [dashboardStatus, setDashboardStatus] = useState<DashboardStatus>("idle");
  const [youthStatus, setYouthStatus] = useState<DashboardStatus>("idle");
  const [youthAcademy, setYouthAcademy] = useState<RealYouthAcademyPlanning | null>(null);
  const [youthPipelineStatus, setYouthPipelineStatus] = useState<DashboardStatus>("idle");
  const [youthPipeline, setYouthPipeline] = useState<YouthPipelinePlanning | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<DashboardStatus>("idle");
  const [training, setTraining] = useState<TrainingPageData | null>(null);
  const [trainingDiagnostic, setTrainingDiagnostic] = useState<ImportResponse["diagnostic"]>(null);
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);

  const loadDiagnosticsData = useCallback(async () => {
    setDashboardStatus("loading");
    setYouthStatus("loading");
    setYouthPipelineStatus("loading");
    setTrainingStatus("loading");

    try {
      const [, youth, pipeline, train, diag, dev] = await Promise.all([
        fetchClubDashboard(),
        fetchRealYouthAcademyPlanning(),
        fetchYouthPipelinePlanning(),
        fetchTrainingPageData(),
        fetchClubDiagnostic(),
        fetchPlayerDevelopment()
      ]);

      setDashboardStatus("ready");
      setYouthAcademy(youth);
      setYouthStatus("ready");
      setYouthPipeline(pipeline);
      setYouthPipelineStatus("ready");
      setTraining(train);
      setTrainingDiagnostic(diag);
      setPlayerDevelopment(dev);
      setTrainingStatus("ready");
      return true;
    } catch {
      setDashboardStatus("error");
      setYouthAcademy(null);
      setYouthStatus("error");
      setYouthPipeline(null);
      setYouthPipelineStatus("error");
      setTraining(null);
      setTrainingDiagnostic(null);
      setPlayerDevelopment(null);
      setTrainingStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setDashboardStatus("idle");
      setYouthAcademy(null);
      setYouthStatus("idle");
      setYouthPipeline(null);
      setYouthPipelineStatus("idle");
      setTraining(null);
      setTrainingDiagnostic(null);
      setPlayerDevelopment(null);
      setTrainingStatus("idle");
      return;
    }

    void loadDiagnosticsData();
  }, [user, loadDiagnosticsData]);

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
        await loadDiagnosticsData();
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadDiagnosticsData]
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
      activeView="diagnostics"
      diagnosticAlertCount={diagnosticAlertCount}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/diagnostics"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
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
    </AppShell>
  );
}

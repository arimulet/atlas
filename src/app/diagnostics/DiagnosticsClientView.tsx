"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchClubDiagnostic,
  fetchPlayerDevelopment,
  fetchRealYouthAcademyPlanning,
  fetchTrainingPageData,
  fetchYouthPipelinePlanning,
  syncSokker,
  type ActiveClubInfo
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
import { useAuth, markSessionAsServerValidated } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";
import type { ServerSessionUser } from "@/lib/session";

interface DiagnosticsClientViewProps {
  initialServerUser: ServerSessionUser | null;
  initialClub: ActiveClubInfo | null;
}

export function DiagnosticsClientView({
  initialServerUser,
  initialClub
}: DiagnosticsClientViewProps) {
  const { user, loading: authLoading } = useAuth();
  const { hydrateClub } = useClub();
  const router = useRouter();

  if (initialServerUser && typeof window !== "undefined") {
    markSessionAsServerValidated();
  }

  useEffect(() => {
    if (initialClub) {
      hydrateClub(initialClub);
    }
  }, [initialClub, hydrateClub]);

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

  const isAuthenticated = Boolean(user || initialServerUser);

  const loadDiagnosticsData = useCallback(async () => {
    setDashboardStatus("loading");
    setYouthStatus("loading");
    setYouthPipelineStatus("loading");
    setTrainingStatus("loading");

    try {
      const [youth, pipeline, train, diag, dev] = await Promise.all([
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
    if (!isAuthenticated && !authLoading) {
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

    if (isAuthenticated) {
      void loadDiagnosticsData();
    }
  }, [isAuthenticated, authLoading, loadDiagnosticsData]);

  const diagnosticAlertCount = useMemo(
    () =>
      (trainingDiagnostic?.findings ?? []).filter(
        (diagnostic) => diagnostic.severity === "high" || diagnostic.severity === "medium"
      ).length,
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

        throw new Error(message || "Failed to update data.");
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
      if (typeof window !== "undefined") {
        window.location.assign(pathForMainView(view));
      } else {
        router.push(pathForMainView(view));
      }
    },
    [router]
  );

  if (authLoading && !initialServerUser) {
    return (
      <div className="atlas-auth-loading-screen">
        <span className="atlas-auth-spinner" aria-hidden="true" />
        <span>Loading ATLAS...</span>
      </div>
    );
  }

  if (!user && !initialServerUser) {
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

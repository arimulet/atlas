"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchClubDashboard,
  fetchClubDiagnostic,
  fetchRealYouthAcademyPlanning,
  fetchSquadDepthAnalysis,
  fetchSquadPlanning,
  fetchSquadPlanningRecommendations,
  syncSokker
} from "@/api";
import type {
  ClubDashboard,
  DashboardStatus,
  ImportResponse,
  RealYouthAcademyPlanning,
  SquadPlanningBundle
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { Dashboard } from "@/components/Dashboard";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView, pathForPlayerDetail } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";
import { useFinancialStrategy } from "@/app/features/financialStrategy/useFinancialStrategy";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [dashboardStatus, setDashboardStatus] = useState<DashboardStatus>("idle");
  const [dashboard, setDashboard] = useState<ClubDashboard | null>(null);
  const [youthStatus, setYouthStatus] = useState<DashboardStatus>("idle");
  const [youthAcademy, setYouthAcademy] = useState<RealYouthAcademyPlanning | null>(null);
  const [squadPlanningStatus, setSquadPlanningStatus] = useState<DashboardStatus>("idle");
  const [squadPlanning, setSquadPlanning] = useState<SquadPlanningBundle | null>(null);
  const [diagnostic, setDiagnostic] = useState<ImportResponse["diagnostic"]>(null);

  const loadDashboardData = useCallback(async () => {
    setDashboardStatus("loading");
    setYouthStatus("loading");
    setSquadPlanningStatus("loading");

    try {
      const [dash, youth, diag, assessment, depth, recommendations] = await Promise.all([
        fetchClubDashboard(),
        fetchRealYouthAcademyPlanning(),
        fetchClubDiagnostic(),
        fetchSquadPlanning(),
        fetchSquadDepthAnalysis(),
        fetchSquadPlanningRecommendations()
      ]);

      setDashboard(dash);
      setDashboardStatus("ready");
      setYouthAcademy(youth);
      setYouthStatus("ready");
      setDiagnostic(diag);
      setSquadPlanning({ assessment, depth, recommendations });
      setSquadPlanningStatus("ready");
      return true;
    } catch {
      setDashboard(null);
      setDashboardStatus("error");
      setYouthAcademy(null);
      setYouthStatus("error");
      setSquadPlanning(null);
      setSquadPlanningStatus("error");
      setDiagnostic(null);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setDashboard(null);
      setDashboardStatus("idle");
      setYouthAcademy(null);
      setYouthStatus("idle");
      setSquadPlanning(null);
      setSquadPlanningStatus("idle");
      setDiagnostic(null);
      return;
    }

    void loadDashboardData();
  }, [user, loadDashboardData]);

  const clubId =
    dashboard?.club?.id ??
    (dashboard?.club?.clubId ? String(dashboard.club.clubId) : null);

  const financialStrategy = useFinancialStrategy({
    clubId,
    currency: dashboard?.club?.currency ?? null,
    squadPlanning
  });

  const diagnosticAlertCount = useMemo(
    () =>
      diagnostic?.findings.filter(
        (finding) => finding.severity === "high" || finding.severity === "medium"
      ).length ?? 0,
    [diagnostic]
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
        const loaded = await loadDashboardData();
        if (!loaded) {
          throw new Error("Datos actualizados, pero no se pudo recargar el Dashboard.");
        }
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadDashboardData]
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
      activeView="dashboard"
      diagnosticAlertCount={diagnosticAlertCount}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <Dashboard
        dashboard={dashboard}
        dashboardStatus={dashboardStatus}
        onSelectPlayer={handleSelectPlayer}
        youthAcademy={youthAcademy}
        youthStatus={youthStatus}
        squadPlanning={squadPlanning}
        squadPlanningStatus={squadPlanningStatus}
        financialStrategy={financialStrategy}
      />
    </AppShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchClubDashboard,
  fetchRealYouthAcademyPlanning,
  syncSokker
} from "@/api";
import type {
  ClubDashboard,
  DashboardStatus,
  RealYouthAcademyPlanning
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { Youth } from "@/components/Youth";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";

export default function YouthPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [dashboard, setDashboard] = useState<ClubDashboard | null>(null);
  const [youthStatus, setYouthStatus] = useState<DashboardStatus>("idle");
  const [youthAcademy, setYouthAcademy] = useState<RealYouthAcademyPlanning | null>(null);

  const loadYouthData = useCallback(async () => {
    setYouthStatus("loading");
    try {
      const [dash, youth] = await Promise.all([
        fetchClubDashboard(),
        fetchRealYouthAcademyPlanning()
      ]);

      setDashboard(dash);
      setYouthAcademy(youth);
      setYouthStatus("ready");
      return true;
    } catch {
      setDashboard(null);
      setYouthAcademy(null);
      setYouthStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setDashboard(null);
      setYouthAcademy(null);
      setYouthStatus("idle");
      return;
    }

    void loadYouthData();
  }, [user, loadYouthData]);

  const clubId =
    dashboard?.club?.id ??
    (dashboard?.club?.clubId ? String(dashboard.club.clubId) : null);
  const currency = dashboard?.club?.currency ?? null;

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
        await loadYouthData();
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadYouthData]
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
      activeView="youth"
      diagnosticAlertCount={0}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/youth"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <Youth
        clubId={clubId}
        currency={currency}
        youthAcademy={youthAcademy}
        youthStatus={youthStatus}
      />
    </AppShell>
  );
}

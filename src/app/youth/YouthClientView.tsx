"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchRealYouthAcademyPlanning,
  syncSokker,
  type ActiveClubInfo
} from "@/api";
import type {
  DashboardStatus,
  RealYouthAcademyPlanning
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { Youth } from "@/components/Youth";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView } from "@/app/routing";
import { useAuth, markSessionAsServerValidated } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";
import type { ServerSessionUser } from "@/lib/session";

interface YouthClientViewProps {
  initialServerUser: ServerSessionUser | null;
  initialClub: ActiveClubInfo | null;
}

export function YouthClientView({ initialServerUser, initialClub }: YouthClientViewProps) {
  const { user, loading: authLoading } = useAuth();
  const { club: clientClub, refreshClub, hydrateClub } = useClub();
  const router = useRouter();

  if (initialServerUser && typeof window !== "undefined") {
    markSessionAsServerValidated();
  }

  useEffect(() => {
    if (initialClub) {
      hydrateClub(initialClub);
    }
  }, [initialClub, hydrateClub]);

  const activeClub = clientClub ?? initialClub;
  const clubId = activeClub?.id ?? (activeClub?.clubId ? String(activeClub.clubId) : null);
  const currency = activeClub?.currency ?? null;

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [youthStatus, setYouthStatus] = useState<DashboardStatus>("idle");
  const [youthAcademy, setYouthAcademy] = useState<RealYouthAcademyPlanning | null>(null);

  const isAuthenticated = Boolean(user || initialServerUser);

  const loadYouthData = useCallback(async () => {
    setYouthStatus("loading");
    try {
      const youth = await fetchRealYouthAcademyPlanning();

      setYouthAcademy(youth);
      setYouthStatus("ready");
      return true;
    } catch {
      setYouthAcademy(null);
      setYouthStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      setYouthAcademy(null);
      setYouthStatus("idle");
      return;
    }

    if (isAuthenticated) {
      void loadYouthData();
    }
  }, [isAuthenticated, authLoading, loadYouthData]);

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
        await Promise.all([loadYouthData(), refreshClub()]);
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadYouthData, refreshClub]
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

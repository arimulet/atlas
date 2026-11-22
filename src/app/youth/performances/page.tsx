"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchRealYouthAcademyPlanning,
  syncSokker
} from "@/api";
import type {
  RealYouthAcademyPlanning
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { YouthPerformances } from "@/components/Youth/YouthPerformances";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";

export default function YouthPerformancesPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, refreshClub } = useClub();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [youthAcademy, setYouthAcademy] = useState<RealYouthAcademyPlanning | null>(null);

  const loadData = useCallback(async () => {
    try {
      const youth = await fetchRealYouthAcademyPlanning();
      setYouthAcademy(youth);
      return true;
    } catch {
      setYouthAcademy(null);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setYouthAcademy(null);
      return;
    }

    void loadData();
  }, [user, loadData]);

  const clubId = club?.id ?? (club?.clubId ? String(club.clubId) : null);

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
        await Promise.all([loadData(), refreshClub()]);
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadData, refreshClub]
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
      activeView="youth-performances"
      diagnosticAlertCount={0}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/youth/performances"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <YouthPerformances
        clubId={clubId}
        youthAcademy={youthAcademy}
      />
    </AppShell>
  );
}

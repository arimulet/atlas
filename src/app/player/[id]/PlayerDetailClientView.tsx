"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchClubDiagnostic,
  fetchPlayerDevelopment,
  fetchSquadDepthAnalysis,
  fetchSquadPlanning,
  fetchSquadPlanningRecommendations,
  fetchTrainingPageData,
  syncSokker,
  type ActiveClubInfo
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
import { useAuth, markSessionAsServerValidated } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";
import type { ServerSessionUser } from "@/lib/session";

interface PlayerDetailClientViewProps {
  id: string;
  initialServerUser: ServerSessionUser | null;
  initialClub: ActiveClubInfo | null;
}

export function PlayerDetailClientView({
  id,
  initialServerUser,
  initialClub
}: PlayerDetailClientViewProps) {
  const { user, loading: authLoading } = useAuth();
  const { club: clientClub, refreshClub, hydrateClub } = useClub();
  const router = useRouter();

  // If server validated user session, inform AuthContext to avoid duplicate CSR /api/user/session call
  if (initialServerUser && typeof window !== "undefined") {
    markSessionAsServerValidated();
  }

  // Hydrate client club context from SSR if provided and not yet hydrated
  useEffect(() => {
    if (initialClub) {
      hydrateClub(initialClub);
    }
  }, [initialClub, hydrateClub]);

  // If client club hasn't loaded yet, fall back to initial server-rendered club
  const activeClub = clientClub ?? initialClub;

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const currency = activeClub?.currency ?? null;
  const clubId = activeClub?.id ?? (activeClub?.clubId ? String(activeClub.clubId) : null);
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment | null>(null);
  const [squadPlanning, setSquadPlanning] = useState<SquadPlanningBundle | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<DashboardStatus>("idle");
  const [training, setTraining] = useState<TrainingPageData | null>(null);
  const [trainingDiagnostic, setTrainingDiagnostic] = useState<ImportResponse["diagnostic"]>(null);

  // Consider authenticated if either the client has a user or server validated the session
  const isAuthenticated = Boolean(user || initialServerUser);

  const loadPlayerData = useCallback(async () => {
    setTrainingStatus("loading");
    try {
      const [dev, train, diag, assessment, depth, recommendations] = await Promise.all([
        fetchPlayerDevelopment(),
        fetchTrainingPageData(),
        fetchClubDiagnostic(),
        fetchSquadPlanning(),
        fetchSquadDepthAnalysis(),
        fetchSquadPlanningRecommendations()
      ]);

      setPlayerDevelopment(dev);
      setTraining(train);
      setTrainingDiagnostic(diag);
      setSquadPlanning({ assessment, depth, recommendations });
      setTrainingStatus("ready");
    } catch {
      setPlayerDevelopment(null);
      setTraining(null);
      setTrainingDiagnostic(null);
      setSquadPlanning(null);
      setTrainingStatus("error");
    }
  }, []);

  useEffect(() => {
    // If not authenticated and client auth finished loading, reset data
    if (!isAuthenticated && !authLoading) {
      setPlayerDevelopment(null);
      setTraining(null);
      setTrainingDiagnostic(null);
      setSquadPlanning(null);
      setTrainingStatus("idle");
      return;
    }

    if (isAuthenticated) {
      void loadPlayerData();
    }
  }, [isAuthenticated, authLoading, loadPlayerData]);

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
        await Promise.all([loadPlayerData(), refreshClub()]);
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadPlayerData, refreshClub]
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

  // If server had no user and client auth is still loading, show loading screen
  if (authLoading && !initialServerUser) {
    return (
      <div className="atlas-auth-loading-screen">
        <span className="atlas-auth-spinner" aria-hidden="true" />
        <span>Loading ATLAS...</span>
      </div>
    );
  }

  // If neither client user nor initial server user is available, render AuthScreen
  if (!user && !initialServerUser) {
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
        onTargetUpdated={loadPlayerData}
      />
    </AppShell>
  );
}

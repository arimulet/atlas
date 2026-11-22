"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchSquadDepthAnalysis,
  fetchSquadPlanning,
  fetchSquadPlanningRecommendations,
  syncSokker,
  type ActiveClubInfo
} from "@/api";
import type {
  DashboardStatus,
  SquadPlanningBundle
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { InvestmentSimulator } from "@/components/InvestmentSimulator";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView } from "@/app/routing";
import { useAuth, markSessionAsServerValidated } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";
import { useFinancialStrategy } from "@/app/features/financialStrategy/useFinancialStrategy";
import type { ServerSessionUser } from "@/lib/session";

interface InvestmentSimulatorClientViewProps {
  initialServerUser: ServerSessionUser | null;
  initialClub: ActiveClubInfo | null;
}

export function InvestmentSimulatorClientView({
  initialServerUser,
  initialClub
}: InvestmentSimulatorClientViewProps) {
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

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [status, setStatus] = useState<DashboardStatus>("idle");
  const [squadPlanning, setSquadPlanning] = useState<SquadPlanningBundle | null>(null);

  const isAuthenticated = Boolean(user || initialServerUser);

  const loadSimulatorData = useCallback(async () => {
    setStatus("loading");
    try {
      const [assessment, depth, recommendations] = await Promise.all([
        fetchSquadPlanning(),
        fetchSquadDepthAnalysis(),
        fetchSquadPlanningRecommendations()
      ]);

      setSquadPlanning({ assessment, depth, recommendations });
      setStatus("ready");
      return true;
    } catch {
      setSquadPlanning(null);
      setStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      setSquadPlanning(null);
      setStatus("idle");
      return;
    }

    if (isAuthenticated) {
      void loadSimulatorData();
    }
  }, [isAuthenticated, authLoading, loadSimulatorData]);

  const clubId = activeClub?.id ?? (activeClub?.clubId ? String(activeClub.clubId) : null);
  const currency = activeClub?.currency ?? null;

  const financialStrategy = useFinancialStrategy({
    clubId,
    currency,
    squadPlanning
  });

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
        await Promise.all([loadSimulatorData(), refreshClub()]);
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, loadSimulatorData, refreshClub]
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
      activeView="investment-simulator"
      diagnosticAlertCount={0}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/investment-simulator"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <div className="atlas-investment-simulator">
        <header className="atlas-investment-simulator__header">
          <h1>Investment Simulator</h1>
        </header>
        {status === "loading" || financialStrategy.status === "loading" ? (
          <p className="atlas-finances-panel__message">Loading financial strategy...</p>
        ) : null}
        {financialStrategy.status === "error" ? (
          <p className="atlas-finances-panel__message is-error">
            Financial Strategy is temporarily unavailable. Simulation will use default benchmarks.
          </p>
        ) : null}
        <InvestmentSimulator financialStrategy={financialStrategy} currency={currency} />
      </div>
    </AppShell>
  );
}

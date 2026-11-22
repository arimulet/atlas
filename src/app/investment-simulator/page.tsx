"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchSquadDepthAnalysis,
  fetchSquadPlanning,
  fetchSquadPlanningRecommendations,
  syncSokker
} from "@/api";
import type {
  DashboardStatus,
  SquadPlanningBundle
} from "@/app/types";
import { AppShell } from "@/components/AppShell";
import { InvestmentSimulator } from "@/components/InvestmentSimulator";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";
import { useFinancialStrategy } from "@/app/features/financialStrategy/useFinancialStrategy";

export default function InvestmentSimulatorPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, refreshClub } = useClub();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);
  const [status, setStatus] = useState<DashboardStatus>("idle");
  const [squadPlanning, setSquadPlanning] = useState<SquadPlanningBundle | null>(null);

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
    if (!user) {
      setSquadPlanning(null);
      setStatus("idle");
      return;
    }

    void loadSimulatorData();
  }, [user, loadSimulatorData]);

  const clubId = club?.id ?? (club?.clubId ? String(club.clubId) : null);
  const currency = club?.currency ?? null;

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

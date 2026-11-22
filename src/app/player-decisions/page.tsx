"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { syncSokker } from "@/api";
import { AppShell } from "@/components/AppShell";
import { PlayerDecisions } from "@/components/PlayerDecisions";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView, pathForPlayerDetail } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";

export default function PlayerDecisionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, refreshClub } = useClub();
  const router = useRouter();

  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);

  const clubId = club?.id ?? (club?.clubId ? String(club.clubId) : null);
  const currency = club?.currency ?? null;

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
        await refreshClub();
        setIsSokkerImportOpen(false);
      }

      return body;
    },
    [user, refreshClub]
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
        <span>Loading ATLAS...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <AppShell
      activeView="player-decisions"
      diagnosticAlertCount={0}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/player-decisions"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <PlayerDecisions
        clubId={clubId}
        currency={currency}
        onSelectPlayer={handleSelectPlayer}
      />
    </AppShell>
  );
}

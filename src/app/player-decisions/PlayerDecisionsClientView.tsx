"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { syncSokker, type ActiveClubInfo } from "@/api";
import { AppShell } from "@/components/AppShell";
import { PlayerDecisions } from "@/components/PlayerDecisions";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { pathForMainView, pathForPlayerDetail } from "@/app/routing";
import { useAuth, markSessionAsServerValidated } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";
import type { ServerSessionUser } from "@/lib/session";

interface PlayerDecisionsClientViewProps {
  initialServerUser: ServerSessionUser | null;
  initialClub: ActiveClubInfo | null;
}

export function PlayerDecisionsClientView({
  initialServerUser,
  initialClub
}: PlayerDecisionsClientViewProps) {
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

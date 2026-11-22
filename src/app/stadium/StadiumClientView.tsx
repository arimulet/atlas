"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Stadium } from "@/components/Stadium";
import { pathForMainView } from "@/app/routing";
import { useAuth, markSessionAsServerValidated } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";
import { BrowserTitle } from "@/components/BrowserTitle";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { syncSokker, type ActiveClubInfo } from "@/api";
import { Building2 } from "lucide-react";
import type { ServerSessionUser } from "@/lib/session";
import "@/components/Stadium/styles.scss";

interface StadiumClientViewProps {
  initialServerUser: ServerSessionUser | null;
  initialClub: ActiveClubInfo | null;
}

export function StadiumClientView({
  initialServerUser,
  initialClub
}: StadiumClientViewProps) {
  const { user, loading: authLoading } = useAuth();
  const { club: clientClub, loading: clubLoading, refreshClub, hydrateClub } = useClub();
  const router = useRouter();
  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);

  if (initialServerUser && typeof window !== "undefined") {
    markSessionAsServerValidated();
  }

  useEffect(() => {
    if (initialClub) {
      hydrateClub(initialClub);
    }
  }, [initialClub, hydrateClub]);

  const activeClub = clientClub ?? initialClub;

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

      await refreshClub();
      setIsSokkerImportOpen(false);
      return body;
    },
    [user, refreshClub]
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

  if ((authLoading || clubLoading) && !initialServerUser) {
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

  const arena = activeClub?.arena ?? null;

  return (
    <AppShell
      activeView="stadium"
      diagnosticAlertCount={0}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/stadium"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <BrowserTitle pageName={arena?.name || "Stadium"} />
      {!arena ? (
        <div className="atlas-stadium-empty">
          <div className="atlas-stadium-empty__card">
            <div className="atlas-stadium-empty__icon">
              <Building2 size={44} />
            </div>
            <h2 className="atlas-stadium-empty__title">Stadium Data Unavailable</h2>
            <p className="atlas-stadium-empty__description">
              Club facility data has not been synchronized from Sokker yet.
              Run a sync to import stadium capacity, stands, and pitch dimensions.
            </p>
            <button
              type="button"
              className="atlas-stadium-empty__btn"
              onClick={() => setIsSokkerImportOpen(true)}
            >
              Sync with Sokker
            </button>
          </div>
        </div>
      ) : (
        <Stadium initialData={arena} />
      )}
    </AppShell>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Stadium } from "@/components/Stadium";
import { pathForMainView } from "@/app/routing";
import { useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/Auth/AuthScreen";
import { BrowserTitle } from "@/components/BrowserTitle";
import { DEFAULT_SOKKER_STADIUM } from "@/domain/stadium/mockData";
import type { SokkerImportCredentials } from "@/components/SokkerImporterForm/types";
import { syncSokker } from "@/api";

export default function StadiumPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
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

      setIsSokkerImportOpen(false);
      return body;
    },
    [user]
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
      activeView="stadium"
      diagnosticAlertCount={0}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey="/stadium"
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <BrowserTitle pageName={DEFAULT_SOKKER_STADIUM.name} />
      <Stadium />
    </AppShell>
  );
}

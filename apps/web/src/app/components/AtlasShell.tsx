"use client";

import { useCallback, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "./AppShell";
import { pathForMainView, getRoute, type MainViewId } from "../routing";
import { useAuth } from "../context/AuthContext";
import { AuthScreen } from "../pages/Auth/AuthScreen";
import { syncSokker } from "../api";
import type { SokkerImportCredentials } from "./SokkerImporterForm/types";

import { useClubData } from "../context/ClubDataContext";

export function AtlasShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const clubData = useClubData();
  const pathname = usePathname();
  const router = useRouter();
  const route = getRoute(pathname || "/");
  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);

  const handleViewChange = useCallback(
    (view: MainViewId) => {
      router.push(pathForMainView(view));
    },
    [router]
  );

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

      setIsSokkerImportOpen(false);
      await clubData.reloadAll();
      router.refresh();
      return body;
    },
    [user, router, clubData]
  );

  if (loading) {
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
      activeView={route.kind === "main" ? route.view : null}
      diagnosticAlertCount={0}
      isSokkerImportOpen={isSokkerImportOpen}
      navigationKey={pathname || "/"}
      onViewChange={handleViewChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      {children}
    </AppShell>
  );
}

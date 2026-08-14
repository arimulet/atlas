import { useCallback, useState } from "react";

import { syncSokkerXml } from "@atlas/web/app/api";
import { AppShell } from "../components/AppShell";
import type { SokkerImportCredentials } from "../components/SokkerImporterForm/types";
import type { V2ViewId } from "../types";
import type { AppV2Props } from "./types";

export function AppV2({ uiVersion, onUiVersionChange }: AppV2Props) {
  const [activeView, setActiveView] = useState<V2ViewId>("dashboard");
  const [isSokkerImportOpen, setIsSokkerImportOpen] = useState(false);

  const handleSokkerImport = useCallback(async (credentials: SokkerImportCredentials) => {
    const { response, body } = await syncSokkerXml(credentials);

    if (!response.ok || body.importResult.status === "rejected") {
      const message = body.importResult.errors.map((error) => error.message).join(" ");

      throw new Error(message || "No se pudieron actualizar los datos.");
    }

    return body;
  }, []);

  return (
    <AppShell
      activeView={activeView}
      isSokkerImportOpen={isSokkerImportOpen}
      onViewChange={setActiveView}
      uiVersion={uiVersion}
      onUiVersionChange={onUiVersionChange}
      onCloseSokkerImport={() => setIsSokkerImportOpen(false)}
      onOpenSokkerImport={() => setIsSokkerImportOpen(true)}
      onSokkerImport={handleSokkerImport}
    >
      <div className="v2-placeholder">
        <span className="v2-placeholder__eyebrow">ATLAS UI V2</span>
        <h1>{activeView === "dashboard" ? "Dashboard" : "Módulo en preparación"}</h1>
        <p>
          {activeView === "dashboard"
            ? "Nueva estructura visual lista para trabajar página por página."
            : "La navegación ya está preparada; el contenido funcional se migrará en una siguiente etapa."}
        </p>
        <div className="v2-placeholder__section">
          <span>Sección seleccionada</span>
          <strong>{activeView}</strong>
        </div>
      </div>
    </AppShell>
  );
}

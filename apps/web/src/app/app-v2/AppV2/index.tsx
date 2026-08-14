import { useState } from "react";

import { AppShell } from "../components/AppShell";
import type { V2ViewId } from "../types";
import type { AppV2Props } from "./types";

export function AppV2({ uiVersion, onUiVersionChange }: AppV2Props) {
  const [activeView, setActiveView] = useState<V2ViewId>("dashboard");

  return (
    <AppShell
      activeView={activeView}
      onViewChange={setActiveView}
      uiVersion={uiVersion}
      onUiVersionChange={onUiVersionChange}
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

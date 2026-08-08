import { ModuleGrid } from "@atlas/web/app/components/ModuleGrid";
import { Section } from "../Section";

export const EmptyDashboardPanel = () => {
  return (
    <Section
      className="dashboard-empty"
      title="Club Dashboard"
      subtitle="No active club yet"
      description="Import a player snapshot to create the club profile, observed settings and historical baseline."
    >
      <ModuleGrid
        areas={[
          {
            key: "diagnostic",
            label: "Diagnostico",
            status: "ready",
            summary: "Listo cuando exista un snapshot de plantilla."
          },
          {
            key: "history",
            label: "Analisis historico",
            status: "ready",
            summary: "Requiere al menos dos snapshots del club."
          },
          {
            key: "economy",
            label: "Economia",
            status: "planned",
            summary: "Acceso futuro; modulo no implementado todavia."
          },
          {
            key: "training",
            label: "Entrenamiento",
            status: "planned",
            summary: "Acceso futuro; modulo no implementado todavia."
          }
        ]}
      />
    </Section>
  );
};

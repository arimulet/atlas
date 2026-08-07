import { ModuleGrid } from "@atlas/web/app/components/ModuleGrid";

export const EmptyDashboardPanel = () => {
  return (
    <section className="panel dashboard-empty">
      <div>
        <p className="eyebrow">Club Dashboard</p>
        <h2>No active club yet</h2>
        <p className="muted">
          Import a player snapshot to create the club profile, observed settings and historical
          baseline.
        </p>
      </div>
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
    </section>
  );
}

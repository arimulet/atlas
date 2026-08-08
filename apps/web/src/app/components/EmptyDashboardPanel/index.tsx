import { Section } from "@atlas/web/app/components/Section";
import { OperationalArea } from "@atlas/web/app/types";
import { ModuleCard } from "@atlas/web/app/components/ModuleCard";

export const EmptyDashboardPanel = () => {
  const areas: OperationalArea[] = [
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
  ];
  return (
    <Section
      className="dashboard-empty"
      title="Club Dashboard"
      subtitle="No active club yet"
      description="Import a player snapshot to create the club profile, observed settings and historical baseline."
    >
      <div className="module-grid">
        {areas.map((area) => (
          <ModuleCard
            key={area.key}
            label={area.label}
            summary={area.summary}
            status={area.status}
          />
        ))}
      </div>
    </Section>
  );
};

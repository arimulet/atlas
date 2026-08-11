import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { YouthPlayerCard } from "@atlas/web/app/components/YouthPipelinePlanningPanel/components/YouthPlayerCard";
import { Section } from "@atlas/web/app/components/Section";
import { IssueList } from "@atlas/web/app/components/IssueList";
import { YouthPipelinePlanningPanelProps } from "./types";

export const YouthPipelinePlanningPanel = ({
  youthPipelinePlanning,
  status,
  onBack
}: YouthPipelinePlanningPanelProps) => {
  if (status === "loading") {
    return <Section description="Cargando pipeline juvenil senior..." />;
  }

  if (status === "error" || !youthPipelinePlanning) {
    return (
      <Section
        tone="error"
        title="Pipeline juvenil senior"
        subtitle="No se pudo cargar el modulo"
        description="Volver al dashboard e intentar nuevamente."
      >
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </Section>
    );
  }

  return (
    <section className="squad-market-view">
      <div className="module-topbar">
        <div>
          <p className="eyebrow">Modulo</p>
          <h2>Pipeline juvenil senior</h2>
        </div>
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </div>

      <Section
        title="Alcance"
        subtitle="Jovenes ya presentes en plantilla"
        description={`Esta vista analiza jugadores del plantel senior con edad menor o igual a{" "}
          ${youthPipelinePlanning.observed.youthAgeThreshold}. No modela escuela juvenil real,
          juveniles externos, plazas, entrenadores, costos ni inversion real de cantera.`}
      />

      <section className="economy-columns">
        <Section title="Observado" subtitle="Cobertura del snapshot">
          <dl className="summary-grid">
            <SummaryItem
              label="Snapshot"
              value={youthPipelinePlanning.snapshotDate ?? "No disponible"}
            />
            <SummaryItem
              label="Plantel senior"
              value={youthPipelinePlanning.observed.coverage.seniorPlayerCount.toString()}
            />
            <SummaryItem
              label="Jovenes senior"
              value={youthPipelinePlanning.observed.coverage.youngSeniorPlayerCount.toString()}
            />
            <SummaryItem
              label="Identidad estable"
              value={youthPipelinePlanning.observed.coverage.playersWithStableIdentity.toString()}
            />
          </dl>
        </Section>

        <Section title="Manual" subtitle="Contexto del club">
          <dl className="summary-grid">
            <SummaryItem
              label="academy.investment"
              value={youthPipelinePlanning.settings.academyInvestment}
            />
            <SummaryItem label="Alcance" value="Plantel senior" />
          </dl>
        </Section>
      </section>

      <Section title="Derivado" subtitle="Clasificacion de jovenes senior">
        <dl className="summary-grid">
          <SummaryItem
            label="Prospecto destacado"
            value={youthPipelinePlanning.derived.categoryCounts.standout_prospect.toString()}
          />
          <SummaryItem
            label="Seguimiento"
            value={youthPipelinePlanning.derived.categoryCounts.follow_up.toString()}
          />
          <SummaryItem
            label="Riesgo estancamiento"
            value={youthPipelinePlanning.derived.categoryCounts.stagnation_risk.toString()}
          />
          <SummaryItem
            label="Datos insuficientes"
            value={youthPipelinePlanning.derived.categoryCounts.insufficient_data.toString()}
          />
        </dl>
      </Section>

      {youthPipelinePlanning.warnings.length > 0 ? (
        <Section title="Advertencias de alcance y evidencia" tone="warning">
          <IssueList issues={youthPipelinePlanning.warnings} />
        </Section>
      ) : null}

      <Section title="Inferido por jugador" subtitle="Prospectos, seguimiento y riesgos">
        <div className="development-list">
          {youthPipelinePlanning.derived.players.length > 0 ? (
            youthPipelinePlanning.derived.players.map((player) => (
              <YouthPlayerCard key={player.snapshotPlayerId} player={player} />
            ))
          ) : (
            <p className="muted">No hay jovenes del plantel senior dentro del umbral definido.</p>
          )}
        </div>
      </Section>
    </section>
  );
};

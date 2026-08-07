import { IssuePanel } from "../IssuePanel";
import { SummaryItem } from "../SummaryItem";
import { YouthPlayerCard } from "./components/YouthPlayerCard";
import { YouthPipelinePlanningPanelProps } from "./types";


export const YouthPipelinePlanningPanel = ({
  youthPipelinePlanning,
  status,
  onBack
}: YouthPipelinePlanningPanelProps) => {
  if (status === "loading") {
    return (
      <section className="panel">
        <p className="loading">Cargando pipeline juvenil senior...</p>
      </section>
    );
  }

  if (status === "error" || !youthPipelinePlanning) {
    return (
      <section className="panel issue-panel error">
        <div className="panel-heading">
          <p className="eyebrow">Pipeline juvenil senior</p>
          <h2>No se pudo cargar el modulo</h2>
        </div>
        <p className="muted">Volver al dashboard e intentar nuevamente.</p>
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </section>
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

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Alcance</p>
          <h2>Jovenes ya presentes en plantilla</h2>
        </div>
        <p className="muted">
          Esta vista analiza jugadores del plantel senior con edad menor o igual a{" "}
          {youthPipelinePlanning.observed.youthAgeThreshold}. No modela escuela juvenil real,
          juveniles externos, plazas, entrenadores, costos ni inversion real de cantera.
        </p>
      </section>

      <section className="economy-columns">
        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Observado</p>
            <h2>Cobertura del snapshot</h2>
          </div>
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
        </section>

        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Manual</p>
            <h2>Contexto del club</h2>
          </div>
          <dl className="summary-grid">
            <SummaryItem
              label="academy.investment"
              value={youthPipelinePlanning.manual.academyInvestment}
            />
            <SummaryItem label="Alcance" value="Plantel senior" />
          </dl>
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Derivado</p>
          <h2>Clasificacion de jovenes senior</h2>
        </div>
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
      </section>

      {youthPipelinePlanning.warnings.length > 0 ? (
        <IssuePanel
          title="Advertencias de alcance y evidencia"
          tone="warning"
          issues={youthPipelinePlanning.warnings.map((warning) => ({
            path: warning.code,
            message: warning.message
          }))}
        />
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Inferido por jugador</p>
          <h2>Prospectos, seguimiento y riesgos</h2>
        </div>
        <div className="development-list">
          {youthPipelinePlanning.derived.players.length > 0 ? (
            youthPipelinePlanning.derived.players.map((player) => (
              <YouthPlayerCard key={player.snapshotPlayerId} player={player} />
            ))
          ) : (
            <p className="muted">No hay jovenes del plantel senior dentro del umbral definido.</p>
          )}
        </div>
      </section>
    </section>
  );
}





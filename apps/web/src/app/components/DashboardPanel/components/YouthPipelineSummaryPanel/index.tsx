import { SummaryItem } from "../../../SummaryItem";
import { YouthPipelineSummaryPanelProps } from "./types";

function labelYouthSignal(signal: string): string {
  if (signal === "standout_prospect") return "Prospecto destacado";
  if (signal === "stagnation_risk") return "Riesgo de estancamiento";
  if (signal === "follow_up") return "Seguimiento";
  return "Datos insuficientes";
}


export const YouthPipelineSummaryPanel = ({
  dashboard,
  onOpenYouthPipelinePlanning
}: YouthPipelineSummaryPanelProps) => {
  const summary = dashboard.youthPipelineSummary;

  return (
    <section className="panel development-summary-panel">
      <div className="panel-heading">
        <p className="eyebrow">Pipeline juvenil senior</p>
        <h2>Jovenes del plantel senior</h2>
      </div>
      <p className="muted">{summary.inferred.headline}</p>
      <dl className="summary-grid development-counts">
        <SummaryItem label="Destacados" value={summary.derived.standoutProspects.toString()} />
        <SummaryItem label="Seguimiento" value={summary.derived.followUpPlayers.toString()} />
        <SummaryItem
          label="Riesgo"
          value={summary.derived.stagnationRiskPlayers.toString()}
        />
        <SummaryItem
          label="Datos insuficientes"
          value={summary.derived.insufficientDataPlayers.toString()}
        />
      </dl>
      <div className="trace-row" aria-label="Origen de la lectura de pipeline juvenil senior">
        <span className="trace-kind observed">
          observado: edad {"<="} {summary.observed.youthAgeThreshold}
        </span>
        <span className="trace-kind manual">manual: {summary.manual.academyInvestment}</span>
        <span className="trace-kind derived">derivado: clasificacion senior</span>
        <span className="trace-kind inferred">inferido: senal prudente</span>
      </div>
      {summary.inferred.warning ? (
        <p className="inline-warning">{summary.inferred.warning}</p>
      ) : null}
      {summary.inferred.highlightedPlayers.length > 0 ? (
        <div className="highlight-list">
          {summary.inferred.highlightedPlayers.map((player) => (
            <article className="highlight-row" key={`${player.playerId ?? player.name}`}>
              <div>
                <strong>{player.name}</strong>
                <span>{labelYouthSignal(player.signal)}</span>
              </div>
              <span className={`severity ${player.severity}`}>{player.confidence}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Esta lectura no usa escuela juvenil real; requiere jovenes ya presentes en plantilla.
        </p>
      )}
      {summary.available ? (
        <button type="button" onClick={onOpenYouthPipelinePlanning}>
          Abrir pipeline juvenil senior
        </button>
      ) : null}
    </section>
  );
}
import { SummaryItem } from "../../../SummaryItem";
import { DevelopmentSummaryPanelProps } from "./types";

function labelDevelopmentSignal(signal: string): string {
  if (signal === "improvement") return "Mejora observada";
  if (signal === "stagnation") return "Estancamiento observado";
  if (signal === "decline") return "Deterioro observado";
  return "Datos insuficientes";
}

export const DevelopmentSummaryPanel = ({
  dashboard,
  onOpenPlayerDevelopment
}: DevelopmentSummaryPanelProps) => {
  const summary = dashboard.developmentSummary;

  return (
    <section className="panel development-summary-panel">
      <div className="panel-heading">
        <p className="eyebrow">Desarrollo de jugadores</p>
        <h2>Lectura operativa</h2>
      </div>
      <p className="muted">{summary.inferred.headline}</p>
      <dl className="summary-grid development-counts">
        <SummaryItem label="En mejora" value={summary.derived.improvingPlayers.toString()} />
        <SummaryItem label="Estancados" value={summary.derived.stagnatedPlayers.toString()} />
        <SummaryItem label="En deterioro" value={summary.derived.decliningPlayers.toString()} />
        <SummaryItem
          label="Datos insuficientes"
          value={summary.derived.insufficientDataPlayers.toString()}
        />
      </dl>
      <div className="trace-row" aria-label="Origen de la lectura de desarrollo">
        <span className="trace-kind observed">
          observado: {summary.observed.snapshotCount} snapshots
        </span>
        <span className="trace-kind manual">manual: {summary.manual.trainingPriority}</span>
        <span className="trace-kind derived">derivado: conteos por evolucion</span>
        <span className="trace-kind inferred">inferido: senal ejecutiva</span>
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
                <span>{labelDevelopmentSignal(player.signal)}</span>
              </div>
              <span className={`severity ${player.severity}`}>{player.confidence}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Importa snapshots comparables para destacar jugadores con senales de evolucion.
        </p>
      )}
      {summary.available ? (
        <button type="button" onClick={onOpenPlayerDevelopment}>
          Abrir detalle de desarrollo
        </button>
      ) : null}
    </section>
  );
}
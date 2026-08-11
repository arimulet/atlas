import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { DevelopmentSummaryPanelProps } from "./types";
import { TraceKind } from "../../../TraceKind";
import { Section } from "../../../Section";
import { formatTrainingPriority } from "@atlas/web/app/formatters";

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
    <Section
      className="development-summary-panel"
      title="Desarrollo de jugadores"
      subtitle="Lectura operativa"
      description={summary.inferred.headline}
    >
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
        <TraceKind
          type="observed"
          label={`observado: ${summary.observed.snapshotCount} snapshots`}
        />
        <TraceKind type="manual" label={`manual: ${formatTrainingPriority(Number(summary.settings.trainingPriority))}`} />
        <TraceKind type="derived" label="derivado: conteos por evolucion" />
        <TraceKind label="inferido: senal ejecutiva" type="inferred" />
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
    </Section>
  );
};

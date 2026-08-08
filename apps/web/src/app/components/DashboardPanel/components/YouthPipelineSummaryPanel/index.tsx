import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { YouthPipelineSummaryPanelProps } from "./types";
import { TraceKind } from "../../../TraceKind";
import { Section } from "../../../Section";

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
    <Section className="development-summary-panel" title="Pipeline juvenil senior" subtitle="Jovenes del plantel senior" description={summary.inferred.headline}>     
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
        <TraceKind type="observed" label={`observado: edad ${"<="} ${summary.observed.youthAgeThreshold}`} />
        <TraceKind type="manual" label={`manual: ${summary.manual.academyInvestment}`} />
        <TraceKind type="derived" label="derivado: clasificacion senior" />
        <TraceKind type="inferred" label="inferido: senal prudente" />
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
    </Section>
  );
}
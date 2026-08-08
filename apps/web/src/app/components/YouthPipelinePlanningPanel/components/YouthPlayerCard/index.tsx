import { formatNullable } from "@atlas/web/app/formatters";
import { YouthPipelinePlayerPlan } from "@atlas/web/app/types";
import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { EvidenceList } from "@atlas/web/app/components/EvidenceList";
import { TraceKind } from "@atlas/web/app/components/TraceKind";
import { Section } from "@atlas/web/app/components/Section";
import { IssueList } from "@atlas/web/app/components/IssueList";
import { YouthPlayerCardProps } from "./types";

function labelCategory(category: YouthPipelinePlayerPlan["category"]): string {
  if (category === "standout_prospect") return "destacado";
  if (category === "stagnation_risk") return "riesgo";
  if (category === "follow_up") return "seguimiento";
  return "datos insuficientes";
}

function formatPercent(value: number | null): string {
  if (value === null) return "No comparable";

  return `${(value * 100).toFixed(1)}%`;
}

export const YouthPlayerCard = ({ player }: YouthPlayerCardProps) => {
  return (
    <article className="finding-card development-card">
      <div className="finding-header">
        <div>
          <h3>{player.name}</h3>
          <p className="muted">
            {player.age} anos - {player.role.label} ({player.role.source})
          </p>
        </div>
        <span className={`severity ${player.severity}`}>{labelCategory(player.category)}</span>
      </div>
      <p className="muted">{player.rationale}</p>
      <div className="trace-row">
        <span className="confidence">Confianza: {player.confidence}</span>
        <TraceKind
          type="derived"
          label={`ventana: ${player.context.window.from ?? "sin inicio"} - ${player.context.window.to ?? "sin cierre"}`}
        />
        <TraceKind type="derived" label={`snapshots: ${player.context.window.snapshotCount}`} />
      </div>

      <dl className="summary-grid compact-summary">
        <SummaryItem
          label="Skills comparables"
          value={player.context.dataCompleteness.comparableSkills.toString()}
        />
        <SummaryItem
          label="Skills completas"
          value={player.context.dataCompleteness.completeSkills ? "Si" : "No"}
        />
        <SummaryItem
          label="Valor estimado"
          value={`${formatNullable(player.context.valueAndWage.estimatedValue)} ${
            player.context.valueAndWage.estimatedValueCurrency ?? ""
          }`.trim()}
        />
        <SummaryItem
          label="Salario"
          value={`${formatNullable(player.context.valueAndWage.wage)} ${
            player.context.valueAndWage.wageCurrency ?? ""
          }`.trim()}
        />
        <SummaryItem
          label="Var. valor"
          value={formatPercent(player.context.valueAndWage.valueDeltaPercent)}
        />
        <SummaryItem
          label="Var. salario"
          value={formatPercent(player.context.valueAndWage.wageDeltaPercent)}
        />
      </dl>

      <div className="trace-row" aria-label={`Limites de lectura de ${player.name}`}>
        {player.context.limits.map((limit) => (
          <TraceKind type="inferred" label={limit} />
        ))}
      </div>

      {player.warnings.length > 0 ? (
        <Section title="Advertencias del jugador" tone="warning">
          <IssueList issues={player.warnings} />
        </Section>
      ) : null}

      <div className="finding-list">
        {player.signals.map((signal) => (
          <article className="signal-card" key={signal.code}>
            <div className="finding-header">
              <strong>{signal.message}</strong>
              <span className={`severity ${signal.severity}`}>{signal.severity}</span>
            </div>
            <span className="confidence">Confianza: {signal.confidence}</span>
            <EvidenceList evidence={signal.evidence} />
          </article>
        ))}
      </div>
    </article>
  );
};

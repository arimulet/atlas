import { formatMoney, formatNullable } from "@atlas/web/app/formatters";
import { EvidenceList } from "@atlas/web/app/components/EvidenceList";
import { IssuePanel } from "@atlas/web/app/components/IssuePanel";
import { SummaryItem } from "@atlas/web/app/components/SummaryItem";

import { ConcentrationPanel } from "./components/ConcentrationPanel";
import { EvidencePanel } from "./components/EvidencePanel";
import { HistoricalPanel } from "./components/HistoricalPanel";
import { PlayerDetailPanel } from "./components/PlayerDetailPanel";
import { SquadEconomyPanelProps } from "./types";
import { Section } from "../Section";

function formatRatio(value: number | null): string {
  return value === null ? "No disponible" : value.toFixed(4);
}

export const SquadEconomyPanel = ({ squadEconomy, status, onBack }: SquadEconomyPanelProps) => {
  if (status === "loading") {
    return (
      <section className="panel">
        <p className="loading">Cargando Economia de plantilla...</p>
      </section>
    );
  }

  if (status === "error" || !squadEconomy) {
    return (
      <Section
        className="issue-panel error"
        title="Economia de plantilla"
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
    <section className="squad-economy-view">
      <div className="module-topbar">
        <div>
          <p className="eyebrow">Modulo</p>
          <h2>Economia de plantilla</h2>
        </div>
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </div>

      <Section
        title="Alcance"
        subtitle="Lectura derivada de plantilla"
        description="Este modulo usa salarios, valores estimados, snapshots y tolerancia de riesgo. No representa caja, ingresos, gastos no salariales, estadio, sponsors, transferencias externas ni liquidez real."
      />

      <Section title="Derivado" subtitle="Resumen economico observado">
        <dl className="summary-grid">
          <SummaryItem label="Masa salarial" value={formatMoney(squadEconomy.derived.totalWage)} />
          <SummaryItem
            label="Valor estimado total"
            value={formatMoney(squadEconomy.derived.totalEstimatedValue)}
          />
          <SummaryItem
            label="Relacion salario/valor"
            value={formatRatio(squadEconomy.derived.wageToValueRatio)}
          />
          <SummaryItem label="Snapshot" value={squadEconomy.snapshotDate ?? "No disponible"} />
        </dl>
      </Section>

      <section className="economy-columns">
        <EvidencePanel squadEconomy={squadEconomy} />
        <Section title="Manual" subtitle="Settings efectivos">
          <dl className="summary-grid">
            <SummaryItem
              label="Moneda operativa"
              value={formatNullable(squadEconomy.manual.currency)}
            />
            <SummaryItem label="Tolerancia de riesgo" value={squadEconomy.manual.riskTolerance} />
          </dl>
        </Section>
      </section>

      <section className="economy-columns">
        <ConcentrationPanel
          title="Concentracion salarial"
          items={squadEconomy.derived.concentration.wage}
        />
        <ConcentrationPanel
          title="Concentracion de valor"
          items={squadEconomy.derived.concentration.estimatedValue}
        />
      </section>

      <PlayerDetailPanel players={squadEconomy.derived.playerDetails} />

      <HistoricalPanel squadEconomy={squadEconomy} />

      {squadEconomy.warnings.length > 0 ? (
        <IssuePanel
          title="Advertencias de evidencia"
          tone="warning"
          issues={squadEconomy.warnings.map((warning) => ({
            path: warning.code,
            message: warning.message
          }))}
        />
      ) : null}

      <Section title="Inferido" subtitle="Hallazgos explicables">
        <div className="finding-list">
          {squadEconomy.findings.length > 0 ? (
            squadEconomy.findings.map((finding) => (
              <article className="finding-card" key={finding.code}>
                <div className="finding-header">
                  <h3>{finding.title}</h3>
                  <span className={`severity ${finding.severity}`}>{finding.severity}</span>
                </div>
                <p className="finding-description">{finding.description}</p>
                <span className="confidence">Confianza: {finding.confidence}</span>
                <EvidenceList evidence={finding.evidence} />
              </article>
            ))
          ) : (
            <p className="muted">Sin hallazgos fuertes con la evidencia disponible.</p>
          )}
        </div>
      </Section>
    </section>
  );
};

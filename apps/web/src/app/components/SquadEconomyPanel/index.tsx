import { formatMoney, formatNullable } from "../../formatters";
import { EvidenceList } from "../EvidenceList";

import { IssuePanel } from "../IssuePanel";
import { SummaryItem } from "../SummaryItem";
import { ConcentrationPanel } from "./components/ConcentrationPanel";
import { EvidencePanel } from "./components/EvidencePanel";
import { HistoricalPanel } from "./components/HistoricalPanel";
import { PlayerDetailPanel } from "./components/PlayerDetailPanel";
import { SquadEconomyPanelProps } from "./types";

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
      <section className="panel issue-panel error">
        <div className="panel-heading">
          <p className="eyebrow">Economia de plantilla</p>
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

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Alcance</p>
          <h2>Lectura derivada de plantilla</h2>
        </div>
        <p className="muted">
          Este modulo usa salarios, valores estimados, snapshots y tolerancia de riesgo. No
          representa caja, ingresos, gastos no salariales, estadio, sponsors, transferencias
          externas ni liquidez real.
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Derivado</p>
          <h2>Resumen economico observado</h2>
        </div>
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
      </section>

      <section className="economy-columns">
        <EvidencePanel squadEconomy={squadEconomy} />
        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Manual</p>
            <h2>Settings efectivos</h2>
          </div>
          <dl className="summary-grid">
            <SummaryItem
              label="Moneda operativa"
              value={formatNullable(squadEconomy.manual.currency)}
            />
            <SummaryItem label="Tolerancia de riesgo" value={squadEconomy.manual.riskTolerance} />
          </dl>
        </section>
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

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Inferido</p>
          <h2>Hallazgos explicables</h2>
        </div>
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
      </section>
    </section>
  );
}
import { formatMoney, formatNullable } from "../formatters";
import type {
  SquadEconomy,
  SquadEconomyConcentration,
  SquadEconomyEvidence,
  SquadEconomyPlayerDetail
} from "../types";
import { IssuePanel } from "./IssuePanel";
import { SummaryItem } from "./SummaryItem";

export interface SquadEconomyPanelProps {
  squadEconomy: SquadEconomy | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}

export function SquadEconomyPanel({ squadEconomy, status, onBack }: SquadEconomyPanelProps) {
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

function EvidencePanel({ squadEconomy }: { squadEconomy: SquadEconomy }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Observado</p>
        <h2>Cobertura de datos</h2>
      </div>
      <dl className="summary-grid">
        <SummaryItem
          label="Jugadores"
          value={squadEconomy.observed.coverage.playerCount.toString()}
        />
        <SummaryItem
          label="Con salario"
          value={squadEconomy.observed.coverage.playersWithWage.toString()}
        />
        <SummaryItem
          label="Con valor"
          value={squadEconomy.observed.coverage.playersWithEstimatedValue.toString()}
        />
        <SummaryItem
          label="Moneda observada"
          value={
            squadEconomy.observed.coverage.wageCurrency ??
            squadEconomy.observed.coverage.estimatedValueCurrency ??
            "No disponible"
          }
        />
      </dl>
    </section>
  );
}

function PlayerDetailPanel({ players }: { players: SquadEconomyPlayerDetail[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Derivado por jugador</p>
        <h2>Ranking de riesgo relativo</h2>
      </div>
      <div className="player-detail-table" role="table" aria-label="Detalle por jugador">
        <div className="player-detail-row header" role="row">
          <span role="columnheader">Jugador</span>
          <span role="columnheader">Salario</span>
          <span role="columnheader">Valor</span>
          <span role="columnheader">Salario</span>
          <span role="columnheader">Valor</span>
          <span role="columnheader">Ratio</span>
          <span role="columnheader">Advertencias</span>
        </div>
        {players.slice(0, 8).map((player) => (
          <div className="player-detail-row" role="row" key={player.snapshotPlayerId}>
            <strong role="cell">{player.name}</strong>
            <span role="cell">{formatMoneyValue(player.wage)}</span>
            <span role="cell">{formatMoneyValue(player.estimatedValue)}</span>
            <span role="cell">{formatPercent(player.wageShare)}</span>
            <span role="cell">{formatPercent(player.estimatedValueShare)}</span>
            <span role="cell">{formatRatio(player.wageToValueRatio)}</span>
            <span role="cell">
              {player.warnings.length > 0
                ? player.warnings.map((warning) => warning.code).join(", ")
                : "Sin advertencias"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConcentrationPanel({
  title,
  items
}: {
  title: string;
  items: SquadEconomyConcentration[];
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Derivado</p>
        <h2>{title}</h2>
      </div>
      <div className="concentration-list">
        {items.slice(0, 5).map((item) => (
          <div className="concentration-row" key={item.snapshotPlayerId}>
            <div>
              <strong>{item.name}</strong>
              <span>{`${item.currency ?? "mixed"} ${item.amount.toLocaleString("en-US")}`}</span>
            </div>
            <span>{formatPercent(item.share)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoricalPanel({ squadEconomy }: { squadEconomy: SquadEconomy }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Derivado</p>
        <h2>Historico comparable</h2>
      </div>
      <dl className="summary-grid">
        <SummaryItem
          label="Snapshots comparables"
          value={squadEconomy.historical.comparableSnapshotCount.toString()}
        />
        <SummaryItem
          label="Variacion salarial"
          value={formatPercent(squadEconomy.historical.changes.totalWageDeltaPercent)}
        />
        <SummaryItem
          label="Variacion valor"
          value={formatPercent(squadEconomy.historical.changes.totalEstimatedValueDeltaPercent)}
        />
        <SummaryItem
          label="Cambio ratio"
          value={formatRatio(squadEconomy.historical.changes.wageToValueRatioDelta)}
        />
      </dl>
    </section>
  );
}

function EvidenceList({ evidence }: { evidence: SquadEconomyEvidence[] }) {
  return (
    <ul className="issue-list">
      {evidence.map((item) => (
        <li key={`${item.kind}-${item.label}`}>
          <span className={`trace-kind ${item.kind}`}>{item.kind}</span>
          <span>
            {item.label}: <strong>{formatNullable(item.value)}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatMoneyValue(value: { amount: number; currency: string | null }): string {
  return `${value.currency ?? "mixed"} ${value.amount.toLocaleString("en-US")}`;
}

function formatRatio(value: number | null): string {
  return value === null ? "No disponible" : value.toFixed(4);
}

function formatPercent(value: number | null): string {
  return value === null ? "No disponible" : `${(value * 100).toFixed(1)}%`;
}

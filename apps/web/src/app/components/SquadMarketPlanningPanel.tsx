import { formatNullable } from "../formatters";
import type { SquadMarketEvidence, SquadMarketPlanning, SquadMarketPlayerPlan } from "../types";
import { IssuePanel } from "./IssuePanel";
import { SummaryItem } from "./SummaryItem";

export interface SquadMarketPlanningPanelProps {
  squadMarketPlanning: SquadMarketPlanning | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}

export function SquadMarketPlanningPanel({
  squadMarketPlanning,
  status,
  onBack
}: SquadMarketPlanningPanelProps) {
  if (status === "loading") {
    return (
      <section className="panel">
        <p className="loading">Cargando planificacion interna de mercado...</p>
      </section>
    );
  }

  if (status === "error" || !squadMarketPlanning) {
    return (
      <section className="panel issue-panel error">
        <div className="panel-heading">
          <p className="eyebrow">Planificacion interna de mercado</p>
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
          <h2>Planificacion interna de mercado</h2>
        </div>
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Alcance</p>
          <h2>Activos propios, senales prudentes</h2>
        </div>
        <p className="muted">
          Esta vista clasifica jugadores propios para revision interna. No usa mercado externo,
          listados, pujas, compras, ventas reales, comparables externos, presupuesto ni liquidez.
        </p>
      </section>

      <section className="economy-columns">
        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Observado</p>
            <h2>Cobertura del snapshot</h2>
          </div>
          <dl className="summary-grid">
            <SummaryItem label="Snapshot" value={squadMarketPlanning.snapshotDate ?? "No disponible"} />
            <SummaryItem
              label="Jugadores"
              value={squadMarketPlanning.observed.coverage.playerCount.toString()}
            />
            <SummaryItem
              label="Con salario"
              value={squadMarketPlanning.observed.coverage.playersWithWage.toString()}
            />
            <SummaryItem
              label="Con valor"
              value={squadMarketPlanning.observed.coverage.playersWithEstimatedValue.toString()}
            />
          </dl>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Manual</p>
            <h2>Contexto del club</h2>
          </div>
          <dl className="summary-grid">
            <SummaryItem label="market.strategy" value={squadMarketPlanning.manual.marketStrategy} />
            <SummaryItem label="Alcance" value="Plantel propio" />
          </dl>
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Derivado</p>
          <h2>Clasificacion interna</h2>
        </div>
        <dl className="summary-grid">
          <SummaryItem
            label="Venta"
            value={squadMarketPlanning.derived.categoryCounts.sale_candidate.toString()}
          />
          <SummaryItem
            label="Proteccion"
            value={squadMarketPlanning.derived.categoryCounts.protection_candidate.toString()}
          />
          <SummaryItem
            label="Seguimiento"
            value={squadMarketPlanning.derived.categoryCounts.follow_up.toString()}
          />
          <SummaryItem
            label="Sin senal"
            value={squadMarketPlanning.derived.categoryCounts.insufficient_signal.toString()}
          />
        </dl>
      </section>

      {squadMarketPlanning.warnings.length > 0 ? (
        <IssuePanel
          title="Advertencias de evidencia"
          tone="warning"
          issues={squadMarketPlanning.warnings.map((warning) => ({
            path: warning.code,
            message: warning.message
          }))}
        />
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Inferido por jugador</p>
          <h2>Candidatos y seguimiento</h2>
        </div>
        <div className="development-list">
          {squadMarketPlanning.derived.players.map((player) => (
            <MarketPlayerCard key={player.snapshotPlayerId} player={player} />
          ))}
        </div>
      </section>
    </section>
  );
}

function MarketPlayerCard({ player }: { player: SquadMarketPlayerPlan }) {
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
      <span className="confidence">Confianza: {player.confidence}</span>

      {player.warnings.length > 0 ? (
        <IssuePanel
          title="Advertencias del jugador"
          tone="warning"
          issues={player.warnings.map((warning) => ({
            path: warning.code,
            message: warning.message
          }))}
        />
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
}

function EvidenceList({ evidence }: { evidence: SquadMarketEvidence[] }) {
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

function labelCategory(category: SquadMarketPlayerPlan["category"]): string {
  if (category === "sale_candidate") return "venta";
  if (category === "protection_candidate") return "proteccion";
  if (category === "follow_up") return "seguimiento";
  return "sin senal";
}

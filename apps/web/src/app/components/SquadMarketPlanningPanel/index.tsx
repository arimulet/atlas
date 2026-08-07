import { IssuePanel } from "../IssuePanel";
import { SummaryItem } from "../SummaryItem";
import { MarketPlayerCard } from "./components/MarketPlayerCard";
import { SquadMarketPlanningPanelProps } from "./types";


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




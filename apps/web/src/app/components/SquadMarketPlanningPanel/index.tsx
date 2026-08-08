import { IssuePanel } from "@atlas/web/app/components/IssuePanel";
import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { MarketPlayerCard } from "./components/MarketPlayerCard";
import { SquadMarketPlanningPanelProps } from "./types";
import { Section } from "../Section";

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
      <Section
        className="issue-panel error"
        title="Planificacion interna de mercado"
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

      <Section
        title="Alcance"
        subtitle="Activos propios, senales prudentes"
        description="Esta vista clasifica jugadores propios para revision interna. No usa mercado externo, listados, pujas, compras, ventas reales, comparables externos, presupuesto ni liquidez."
      />

      <section className="economy-columns">
        <Section title="Observado" subtitle="Cobertura del snapshot">
          <dl className="summary-grid">
            <SummaryItem
              label="Snapshot"
              value={squadMarketPlanning.snapshotDate ?? "No disponible"}
            />
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
        </Section>

        <Section title="Manual" subtitle="Contexto del club">
          <dl className="summary-grid">
            <SummaryItem
              label="market.strategy"
              value={squadMarketPlanning.manual.marketStrategy}
            />
            <SummaryItem label="Alcance" value="Plantel propio" />
          </dl>
        </Section>
      </section>

      <Section title="Derivado" subtitle="Clasificacion interna">
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
      </Section>

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

      <Section title="Inferido por jugador" subtitle="Candidatos y seguimiento">
        <div className="development-list">
          {squadMarketPlanning.derived.players.map((player) => (
            <MarketPlayerCard key={player.snapshotPlayerId} player={player} />
          ))}
        </div>
      </Section>
    </section>
  );
}

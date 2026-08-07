import { SummaryItem } from "../../../SummaryItem";
import { MarketSummaryPanelProps } from "./types";

function labelMarketSignal(signal: string): string {
  if (signal === "sale_candidate") return "Candidato a venta";
  if (signal === "protection_candidate") return "Proteccion";
  if (signal === "follow_up") return "Seguimiento";
  return "Datos insuficientes";
}

export const  MarketSummaryPanel = ({
  dashboard,
  onOpenSquadMarketPlanning
}: MarketSummaryPanelProps) => {
  const summary = dashboard.marketSummary;

  return (
    <section className="panel development-summary-panel">
      <div className="panel-heading">
        <p className="eyebrow">Mercado interno</p>
        <h2>Lectura operativa</h2>
      </div>
      <p className="muted">{summary.inferred.headline}</p>
      <dl className="summary-grid development-counts">
        <SummaryItem label="Venta" value={summary.derived.saleCandidates.toString()} />
        <SummaryItem label="Proteccion" value={summary.derived.protectionCandidates.toString()} />
        <SummaryItem label="Seguimiento" value={summary.derived.followUpPlayers.toString()} />
        <SummaryItem
          label="Datos insuficientes"
          value={summary.derived.insufficientSignalPlayers.toString()}
        />
      </dl>
      <div className="trace-row" aria-label="Origen de la lectura de mercado interno">
        <span className="trace-kind observed">
          observado: {summary.observed.snapshotCount} snapshots
        </span>
        <span className="trace-kind manual">manual: {summary.manual.marketStrategy}</span>
        <span className="trace-kind derived">derivado: categorias internas</span>
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
                <span>
                  {labelMarketSignal(player.signal)} - {player.timing}
                </span>
              </div>
              <span className={`severity ${player.severity}`}>{player.confidence}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Importa snapshots con salarios, valores e identidad estable para destacar candidatos.
        </p>
      )}
      {summary.available ? (
        <button type="button" onClick={onOpenSquadMarketPlanning}>
          Abrir detalle de mercado interno
        </button>
      ) : null}
    </section>
  );
}
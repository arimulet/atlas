import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { HistoricalPanelProps } from "./types";

function formatPercent(value: number | null): string {
  return value === null ? "No disponible" : `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null): string {
  return value === null ? "No disponible" : value.toFixed(4);
}


export const HistoricalPanel = ({ squadEconomy }: HistoricalPanelProps) => {
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
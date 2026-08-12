import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { HistoricalPanelProps } from "./types";
import { Section } from "../../../Section";

function formatPercent(value: number | null): string {
  return value === null ? "No disponible" : `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null): string {
  return value === null ? "No disponible" : value.toFixed(4);
}

export const HistoricalPanel = ({ squadEconomy }: HistoricalPanelProps) => {
  return (
    <Section title="Derivado" subtitle="Historico comparable">
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
          value={formatPercent(squadEconomy.historical.changes.totalValueDeltaPercent)}
        />
        <SummaryItem
          label="Cambio ratio"
          value={formatRatio(squadEconomy.historical.changes.wageToValueRatioDelta)}
        />
      </dl>
    </Section>
  );
};

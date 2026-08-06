import { formatMoney } from "../formatters";
import type { SquadSummary } from "../types";
import { SummaryItem } from "./SummaryItem";

export interface SummaryPanelProps {
  summary: SquadSummary;
}

export function SummaryPanel({ summary }: SummaryPanelProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Imported Data</p>
        <h2>Squad summary</h2>
      </div>
      <dl className="summary-grid">
        <SummaryItem label="Club" value={summary.club} />
        <SummaryItem label="Snapshot date" value={summary.snapshotDate} />
        <SummaryItem label="Players" value={summary.playerCount.toString()} />
        <SummaryItem
          label="Total estimated value"
          value={formatMoney(summary.totalEstimatedValue)}
        />
        <SummaryItem label="Total wage" value={formatMoney(summary.totalWage)} />
        <SummaryItem label="Incomplete players" value={summary.incompletePlayerCount.toString()} />
      </dl>
    </section>
  );
}

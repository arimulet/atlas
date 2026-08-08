import { formatMoney } from "@atlas/web/app/formatters";

import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { SummaryPanelProps } from "./types";
import { Section } from "../Section";

export const SummaryPanel = ({ summary }: SummaryPanelProps) => {
  return (
    <Section title="Imported Data" subtitle="Squad summary">
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
    </Section>
  );
}

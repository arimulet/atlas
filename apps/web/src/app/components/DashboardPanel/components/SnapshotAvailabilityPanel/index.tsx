import { formatDateTime } from "@atlas/web/app/formatters";
import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { SnapshotAvailabilityPanelProps } from "./types";
import { Section } from "../../../Section";

export const SnapshotAvailabilityPanel = ({ dashboard }: SnapshotAvailabilityPanelProps) => {
  return (
    <Section title="Snapshots" subtitle="Historical availability">
      <dl className="summary-grid">
        <SummaryItem label="Snapshots" value={dashboard.snapshots.count.toString()} />
        <SummaryItem
          label="Latest snapshot"
          value={dashboard.snapshots.latest?.snapshotDate ?? "Not available"}
        />
        <SummaryItem
          label="Players latest"
          value={dashboard.snapshots.latest?.playerCount.toString() ?? "Not available"}
        />
        <SummaryItem
          label="Comparison"
          value={dashboard.snapshots.canCompare ? "Ready" : "Needs history"}
        />
      </dl>
      {dashboard.snapshots.latest ? (
        <p className="muted">
          Latest import: {formatDateTime(dashboard.snapshots.latest.importedAt)}.
        </p>
      ) : null}
    </Section>
  );
};

import { formatDateTime } from "../../../../formatters";
import { SummaryItem } from "../../../SummaryItem";
import { SnapshotAvailabilityPanelProps } from "./types";

export const SnapshotAvailabilityPanel = ({ dashboard }: SnapshotAvailabilityPanelProps) => {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Snapshots</p>
        <h2>Historical availability</h2>
      </div>
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
    </section>
  );
}

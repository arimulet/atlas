import { Section } from "../../../Section";
import { ConcentrationPanelProps } from "./types";

function formatPercent(value: number | null): string {
  return value === null ? "No disponible" : `${(value * 100).toFixed(1)}%`;
}

export const ConcentrationPanel = ({ title, items }: ConcentrationPanelProps) => {
  return (
    <Section title="Derivado" subtitle={title}>
      <div className="concentration-list">
        {items.slice(0, 5).map((item) => (
          <div className="concentration-row" key={item.snapshotPlayerId}>
            <div>
              <strong>{item.name}</strong>
              <span>{`${item.currency ?? "mixed"} ${item.amount.toLocaleString("en-US")}`}</span>
            </div>
            <span>{formatPercent(item.share)}</span>
          </div>
        ))}
      </div>
    </Section>
  );
};

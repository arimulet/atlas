import { Section } from "../../../Section";
import { ConcentrationPanelProps } from "./types";
import { formatConvertedMoney } from "@atlas/web/app/formatters";

function formatPercent(value: number | null): string {
  return value === null ? "No disponible" : `${(value * 100).toFixed(1)}%`;
}

export const ConcentrationPanel = ({ title, items, countryDetails }: ConcentrationPanelProps & { countryDetails?: { currencyName: string, currencyRate: number } | null }) => {
  return (
    <Section title="Derivado" subtitle={title}>
      <div className="concentration-list">
        {items.slice(0, 5).map((item) => (
          <div className="concentration-row" key={item.snapshotPlayerId}>
            <div>
              <strong>{item.name}</strong>
              <span>{formatConvertedMoney(item.amount, countryDetails)}</span>
            </div>
            <span>{formatPercent(item.share)}</span>
          </div>
        ))}
      </div>
    </Section>
  );
};

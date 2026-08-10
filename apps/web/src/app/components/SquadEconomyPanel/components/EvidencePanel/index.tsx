import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { EvidencePanelProps } from "./types";
import { Section } from "../../../Section";

export const EvidencePanel = ({ squadEconomy }: EvidencePanelProps) => {
  const currencyDisplay = squadEconomy.countryDetails
    ? squadEconomy.countryDetails.currencyName
    : squadEconomy.observed.coverage.wageCurrency ??
      squadEconomy.observed.coverage.estimatedValueCurrency ??
      "No disponible";

  return (
    <Section title="Observado" subtitle="Cobertura de datos">
      <dl className="summary-grid">
        <SummaryItem
          label="Jugadores"
          value={squadEconomy.observed.coverage.playerCount.toString()}
        />
        <SummaryItem
          label="Con salario"
          value={squadEconomy.observed.coverage.playersWithWage.toString()}
        />
        <SummaryItem
          label="Con valor"
          value={squadEconomy.observed.coverage.playersWithEstimatedValue.toString()}
        />
        <SummaryItem
          label="Moneda observada"
          value={currencyDisplay}
        />
      </dl>
    </Section>
  );
};

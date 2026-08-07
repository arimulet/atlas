import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { EvidencePanelProps } from "./types";

export const EvidencePanel = ({ squadEconomy }: EvidencePanelProps) => {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Observado</p>
        <h2>Cobertura de datos</h2>
      </div>
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
          value={
            squadEconomy.observed.coverage.wageCurrency ??
            squadEconomy.observed.coverage.estimatedValueCurrency ??
            "No disponible"
          }
        />
      </dl>
    </section>
  );
}

import { Section } from "../../../Section";
import { PlayerDetailPanelProps } from "./types";

function formatMoneyValue(value: { amount: number; currency: string | null }): string {
  return `${value.currency ?? "mixed"} ${value.amount.toLocaleString("en-US")}`;
}

function formatPercent(value: number | null): string {
  return value === null ? "No disponible" : `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null): string {
  return value === null ? "No disponible" : value.toFixed(4);
}

export const PlayerDetailPanel = ({ players }: PlayerDetailPanelProps) => {
  return (
    <Section title="Derivado por jugador" subtitle="Ranking de riesgo relativo">
      <div className="player-detail-table" role="table" aria-label="Detalle por jugador">
        <div className="player-detail-row header" role="row">
          <span role="columnheader">Jugador</span>
          <span role="columnheader">Salario</span>
          <span role="columnheader">Valor</span>
          <span role="columnheader">Salario</span>
          <span role="columnheader">Valor</span>
          <span role="columnheader">Ratio</span>
          <span role="columnheader">Advertencias</span>
        </div>
        {players.slice(0, 8).map((player) => (
          <div className="player-detail-row" role="row" key={player.snapshotPlayerId}>
            <strong role="cell">{player.name}</strong>
            <span role="cell">{formatMoneyValue(player.wage)}</span>
            <span role="cell">{formatMoneyValue(player.estimatedValue)}</span>
            <span role="cell">{formatPercent(player.wageShare)}</span>
            <span role="cell">{formatPercent(player.estimatedValueShare)}</span>
            <span role="cell">{formatRatio(player.wageToValueRatio)}</span>
            <span role="cell">
              {player.warnings.length > 0
                ? player.warnings.map((warning) => warning.code).join(", ")
                : "Sin advertencias"}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
};

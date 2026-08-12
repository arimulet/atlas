import { Section } from "../../../Section";
import { PlayerDetailPanelProps } from "./types";

import { formatConvertedMoney } from "@atlas/web/app/formatters";

function formatPercent(value: number | null): string {
  return value === null ? "No disponible" : `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null): string {
  return value === null ? "No disponible" : value.toFixed(4);
}

export const PlayerDetailPanel = ({ players, countryDetails }: PlayerDetailPanelProps & { countryDetails?: { currencyName: string, currencyRate: number } | null }) => {
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
            <span role="cell">{formatConvertedMoney(player.wage.amount, countryDetails)}</span>
            <span role="cell">{formatConvertedMoney(player.value.amount, countryDetails)}</span>
            <span role="cell">{formatPercent(player.wageShare)}</span>
            <span role="cell">{formatPercent(player.valueShare)}</span>
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

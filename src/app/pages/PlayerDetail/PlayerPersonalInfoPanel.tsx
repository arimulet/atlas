import type { ReactNode } from "react";
import type { PlayerDetailViewModel } from "../../view-models/player-detail-view-model";
import { CountryNameFlag } from "../../components/CountryNameFlag";

interface PlayerPersonalInfoPanelProps {
  player: PlayerDetailViewModel["player"];
  training: PlayerDetailViewModel["training"];
}

export function PlayerPersonalInfoPanel({ player, training }: PlayerPersonalInfoPanelProps) {
  return (
    <section
      className="atlas-player-detail-panel atlas-player-personal-info"
      aria-labelledby="player-personal-info-title"
    >
      <h2 className="atlas-player-detail-panel__title" id="player-personal-info-title">
        Player Information
      </h2>
      <dl className="atlas-player-personal-info__grid">
        <InfoFact label="Age" value={player.age} />
        <InfoFact
          label="Value"
          value={
            <span className="atlas-player-personal-info__value">
              <span>{player.gameValue ?? "—"}</span>
              {player.gameValueChange ? (
                <span
                  className={`atlas-player-personal-info__value-change is-${player.gameValueChange.direction}`}
                >
                  ({player.gameValueChange.direction === "up" ? "+" : "−"}
                  {player.gameValueChange.label})
                </span>
              ) : null}
            </span>
          }
        />
        <InfoFact
          label="Country"
          value={
            player.countryName ? (
              <span className="atlas-player-personal-info__country">
                <CountryNameFlag countryName={player.countryName} />
                <span>{player.countryName}</span>
              </span>
            ) : (
              "—"
            )
          }
        />
        <InfoFact label="Position" value={positionLabel(training.position)} />
        <InfoFact
          label="Training"
          value={
            <span className="atlas-player-personal-info__training">
              <span aria-hidden="true" title={trainingKindLabel(training.trainingKind)}>
                {trainingKindIcon(training.trainingKind)}
              </span>
              <span>{training.trainedSkill ?? "—"}</span>
              {training.intensity !== null && training.intensity > 0 ? (
                <strong>{training.intensity}%</strong>
              ) : null}
            </span>
          }
        />
      </dl>
    </section>
  );
}

interface InfoFactProps {
  label: string;
  value: number | string | ReactNode;
}

function InfoFact({ label, value }: InfoFactProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function trainingKindIcon(kind: PlayerDetailViewModel["training"]["trainingKind"]): string {
  if (kind === "advanced") return "⚡";
  if (kind === "formation") return "◌";
  return "—";
}

function trainingKindLabel(kind: PlayerDetailViewModel["training"]["trainingKind"]): string {
  if (kind === "advanced") return "Advanced";
  if (kind === "formation") return "Formation";
  if (kind === "missing") return "Missing training";
  return "Training type unavailable";
}

function positionLabel(position: string | null): string {
  const labels: Record<string, string> = {
    GK: "Goalkeeper",
    DEF: "Defender",
    MID: "Midfielder",
    ATT: "Forward"
  };

  return position === null ? "—" : (labels[position] ?? position);
}

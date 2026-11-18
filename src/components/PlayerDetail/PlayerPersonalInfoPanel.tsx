import type { ReactNode } from "react";
import type { PlayerDetailViewModel } from "@/app/view-models/player-detail-view-model";
import { CountryNameFlag } from "@/components/CountryNameFlag";
import { PositionBadge } from "@/components/PositionBadge";
import { PlanningRoleIcon } from "@/components/Squad/PlanningRoleIcon";
import { lifecycleLabel } from "@/components/Squad/squad-planning-view-model";

interface PlayerPersonalInfoPanelProps {
  player: PlayerDetailViewModel["player"];
  training: PlayerDetailViewModel["training"];
  planningRole: PlayerDetailViewModel["planningRole"];
  lifecycle: PlayerDetailViewModel["lifecycle"];
}

export function PlayerPersonalInfoPanel({ player, training, planningRole, lifecycle }: PlayerPersonalInfoPanelProps) {
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
        <InfoFact
          label="Position"
          value={
            training.position ? (
              <span className="atlas-player-personal-info__position">
                <PositionBadge position={training.position} />
                <span>{positionLabel(training.position)}</span>
              </span>
            ) : (
              "—"
            )
          }
        />
        <InfoFact
          label="Planning Role"
          value={
            planningRole ? (
              <span className="atlas-player-personal-info__training">
                <PlanningRoleIcon role={planningRole} />
                <span>{planningRole.charAt(0).toUpperCase() + planningRole.slice(1)}</span>
                {lifecycle ? <span className="atlas-text-muted">{lifecycleLabel(lifecycle)}</span> : null}
              </span>
            ) : lifecycle ? lifecycleLabel(lifecycle) : "—"
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

function positionLabel(position: string | null): string {
  const labels: Record<string, string> = {
    GK: "Goalkeeper",
    DEF: "Defender",
    MID: "Midfielder",
    ATT: "Forward"
  };

  return position === null ? "—" : (labels[position] ?? position);
}

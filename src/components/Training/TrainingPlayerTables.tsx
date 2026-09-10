import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import type { TrainingPageData, TrainingReport } from "@atlas/web/app/types";
import {
  formatEta,
  formatNumber,
  formatPercentage,
  formatTalent,
  formatTrainingPriority
} from "@/app/formatters";
import { CountryNameFlag } from "@/components/CountryNameFlag";
import { PlayerLink } from "@/components/PlayerLink";
import { isSquadSkillRequiredForPosition } from "@/app/view-models/squad-view-model";
import { formatMarketMoney } from "@/app/view-models/market-value-view-model";
import { TrainingDetails } from "./TrainingDetails";
import { PLAYER_SKILL_DEFINITIONS, type PlayerSkillKey } from "@/app/view-models/player-skills";
import {
  createTrainingPlayerRows,
  TRAINING_POSITIONS,
  type TrainingPlayerRow,
  type TrainingPositionCode
} from "@/app/view-models/training-view-model";
import type { TrainingProps } from "./types";

const TRAINING_POSITION_TITLES: Record<TrainingPositionCode, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  ATT: "Attacker"
};

interface TrainingPlayerTablesProps {
  configuration: TrainingPageData["configuration"];
  currency?: string | null;
  diagnostic: TrainingProps["trainingDiagnostic"];
  history: TrainingReport[];
  onSelectPlayer: (playerId: string) => void;
  players: TrainingPageData["players"];
  projectionSummaries: TrainingProps["projectionSummaries"];
  recommendations: ReadonlyMap<string, string>;
}

export function TrainingPlayerTables({
  configuration,
  currency,
  diagnostic,
  history,
  onSelectPlayer,
  players,
  projectionSummaries,
  recommendations
}: TrainingPlayerTablesProps) {
  const rows = createTrainingPlayerRows(players, diagnostic, projectionSummaries);
  const playerById = new Map(players.map((player) => [String(player.playerId), player]));

  return (
    <div className="atlas-training-position-sections">
      {TRAINING_POSITIONS.map((position) => {
        const positionRows = rows
          .filter((player) => player.trainingPosition === position.trainingPosition)
          .sort((a, b) => {
            const valA = a.value ?? -1;
            const valB = b.value ?? -1;
            if (valB !== valA) {
              return valB - valA;
            }
            return a.playerName.localeCompare(b.playerName);
          });

        return (
          <section
            className="atlas-training-position-section"
            key={position.code}
            aria-labelledby={`training-position-${position.code}`}
          >
            <div className="atlas-training-position-section__header">
              <h2 id={`training-position-${position.code}`}>
                {TRAINING_POSITION_TITLES[position.code]} ·{" "}
                {skillLabel(configuration?.[position.code] ?? null)}
              </h2>
              <span>{positionRows.length} players</span>
            </div>
            <TrainingPositionTable
              currency={currency}
              history={history}
              onSelectPlayer={onSelectPlayer}
              playerById={playerById}
              players={positionRows}
              position={position.code}
              recommendations={recommendations}
            />
          </section>
        );
      })}
    </div>
  );
}

interface TrainingPositionTableProps {
  currency?: string | null;
  history: TrainingReport[];
  onSelectPlayer: (playerId: string) => void;
  playerById: Map<string, TrainingPageData["players"][number]>;
  players: TrainingPlayerRow[];
  position: TrainingPositionCode;
  recommendations: ReadonlyMap<string, string>;
}

function TrainingPositionTable({
  currency,
  history,
  onSelectPlayer,
  playerById,
  players,
  position,
  recommendations
}: TrainingPositionTableProps) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  return (
    <div className="atlas-training-table-wrap">
      <table className="atlas-training-table atlas-training-table--skills">
        <colgroup>
          <col className="is-player" />
          <col className="is-talent" />
          <col className="is-age" />
          <col className="is-value" />
          {PLAYER_SKILL_DEFINITIONS.map((skill) => (
            <col className="is-skill" key={skill.key} />
          ))}
          <col className="is-recommendation" />
        </colgroup>
        <thead>
          <tr className="atlas-training-table__columns-row">
            <th scope="col">Player</th>
            <th scope="col">Talent</th>
            <th scope="col">Age</th>
            <th scope="col">Value</th>
            {PLAYER_SKILL_DEFINITIONS.map((skill) => (
              <th
                className={
                  skill.key !== "form" && isSquadSkillRequiredForPosition(position, skill.key)
                    ? "is-position-skill"
                    : undefined
                }
                key={skill.key}
                scope="col"
                title={skill.key}
              >
                {skill.shortLabel}
              </th>
            ))}
            <th scope="col">Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {players.length > 0 ? (
            players.map((player) => (
              <TrainingPlayerRows
                currency={currency}
                history={history.filter((report) => String(report.playerId) === player.playerId)}
                isDetailsOpen={expandedPlayerId === player.playerId}
                key={player.playerId}
                onSelectPlayer={onSelectPlayer}
                onToggleDetails={() =>
                  setExpandedPlayerId((current) =>
                    current === player.playerId ? null : player.playerId
                  )
                }
                player={player}
                position={position}
                recommendation={recommendations.get(player.playerId) ?? ""}
                sourcePlayer={playerById.get(player.playerId) ?? null}
              />
            ))
          ) : (
            <tr>
              <td className="atlas-training-table__empty" colSpan={14}>
                No players assigned.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface TrainingPlayerRowsProps {
  currency?: string | null;
  history: TrainingReport[];
  isDetailsOpen: boolean;
  onSelectPlayer: (playerId: string) => void;
  onToggleDetails: () => void;
  recommendation: string;
  player: TrainingPlayerRow;
  position: TrainingPositionCode;
  sourcePlayer: TrainingPageData["players"][number] | null;
}

function TrainingPlayerRows({
  currency,
  history,
  isDetailsOpen,
  onSelectPlayer,
  onToggleDetails,
  recommendation,
  player,
  position,
  sourcePlayer
}: TrainingPlayerRowsProps) {
  const changes = new Map(
    player.skillChanges.map((change) => [trainingSkillKey(change.skill), change.delta])
  );

  return (
    <>
      <tr>
        <th scope="row">
          <button
            aria-expanded={isDetailsOpen}
            aria-label={`${isDetailsOpen ? "Hide" : "View"} training details for ${player.playerName}`}
            className="atlas-training-player-detail__toggle"
            onClick={onToggleDetails}
            type="button"
          >
            {isDetailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {sourcePlayer?.countryName ? (
            <CountryNameFlag countryName={sourcePlayer.countryName} />
          ) : null}
          <PlayerLink playerId={player.playerId} onSelectPlayer={onSelectPlayer}>
            {player.playerName}
          </PlayerLink>
          <TrainingKind kind={player.trainingKind} />
          <TrainingStatusIndicator status={player.status} />
        </th>
        <td className="atlas-training-table__numeric">{formatTalent(player.talent)}</td>
        <td className="atlas-training-table__numeric">{player.age}</td>
        <td
          className={`atlas-training-table__numeric atlas-training-table__value${
            (sourcePlayer?.valueChange ?? player.valueChange ?? 0) > 0
              ? " is-value-up"
              : (sourcePlayer?.valueChange ?? player.valueChange ?? 0) < 0
              ? " is-value-down"
              : ""
          }`}
        >
          {formatMarketMoney(sourcePlayer?.value ?? player.value, currency ?? null)}
        </td>
        {PLAYER_SKILL_DEFINITIONS.map((skill) => (
          <SkillCell
            change={changes.get(trainingSkillKey(skill.key)) ?? null}
            isImportant={
              skill.key !== "form" && isSquadSkillRequiredForPosition(position, skill.key)
            }
            key={skill.key}
            skill={skill.key}
            value={skillValue(sourcePlayer, sourcePlayer?.latestReport?.skills, skill.key)}
          />
        ))}

        <td className="atlas-training-table__recommendation">{recommendation}</td>
      </tr>
      {isDetailsOpen ? (
        <tr className="atlas-training-player-detail-row">
          <td colSpan={14}>
            <div className="atlas-training-player-detail__content">
              <dl>
                <div>
                  <dt>Talent</dt>
                  <dd>{formatTalent(player.talent)}</dd>
                </div>
                <div>
                  <dt>Next skill-up</dt>
                  <dd>
                    {formatNumber(player.nextSkillUp)} · {formatEta(player.etaWeeks)}
                  </dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>{formatPercentage(player.progress)}</dd>
                </div>
              </dl>
              <TrainingDetails history={history} player={player} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function SkillCell({
  change,
  isImportant,
  skill,
  value
}: {
  change: number | null;
  isImportant: boolean;
  skill: PlayerSkillKey;
  value: number | undefined | null;
}) {
  const changeClass = change === null ? "" : change > 0 ? " is-skill-up" : " is-skill-down";
  const importantClass = isImportant ? " is-position-skill" : "";
  return (
    <td
      className={`atlas-training-table__numeric atlas-training-table__skill${importantClass}${changeClass}`}
      title={change === null ? skill : `${skill} ${change > 0 ? "+" : ""}${change}`}
    >
      <span className="atlas-training-table__skill-value">{value ?? "—"}</span>
      {change !== null && change > 0 ? (
        <span aria-hidden="true" className="atlas-training-table__skill-marker">
          <TrendingUp size={12} />
        </span>
      ) : change !== null && change < 0 ? (
        <span aria-hidden="true" className="atlas-training-table__skill-marker">
          <TrendingDown size={12} />
        </span>
      ) : null}
    </td>
  );
}

function TrainingKind({ kind }: { kind: TrainingPlayerRow["trainingKind"] }) {
  if (kind !== "advanced") return null;
  return (
    <span
      aria-label="Advanced training"
      className="atlas-training-kind is-advanced"
      title="Advanced training"
    >
      <Sparkles size={12} />
    </span>
  );
}

function TrainingStatusIndicator({ status }: { status: TrainingPlayerRow["status"] }) {
  if (status === null) return null;

  const presentation = trainingStatusPresentation(status);
  return (
    <span
      aria-label={presentation.label}
      className={`atlas-training-status-indicator is-${status.toLowerCase().replaceAll(" ", "-")}`}
      title={presentation.label}
    >
      {presentation.icon}
    </span>
  );
}

function trainingStatusPresentation(status: NonNullable<TrainingPlayerRow["status"]>): {
  icon: ReactNode;
  label: string;
} {
  if (status === "Critical") return { icon: <AlertTriangle size={13} />, label: "Critical training warning" };
  if (status === "Attention") return { icon: <AlertCircle size={13} />, label: "Training warning" };
  if (status === "Training prospect") {
    return {
      icon: <Star size={13} />,
      label: "Training prospect: young player with a strong role fit"
    };
  }

  return { icon: <Info size={13} />, label: "Training information" };
}
function skillValue(
  sourcePlayer: TrainingPageData["players"][number] | null,
  skills: TrainingReport["skills"] | undefined,
  skill: PlayerSkillKey
): number | undefined | null {
  if (skill === "form") {
    return sourcePlayer?.form ?? (skills as Record<string, number | null | undefined> | undefined)?.form;
  }
  const key = trainingSkillKey(skill);
  return skills?.[key] ?? skills?.[skill];
}

function trainingSkillKey(skill: string): string {
  if (skill === "defender") return "defending";
  if (skill === "playmaker") return "playmaking";
  return skill;
}

function skillLabel(skill: number | null): string {
  return skill === null ? "—" : formatTrainingPriority(skill);
}

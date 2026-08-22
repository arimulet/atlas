import { useState } from "react";
import type { TrainingPageData, TrainingReport } from "@atlas/web/app/types";
import {
  formatEta,
  formatNumber,
  formatPercentage,
  formatTalent,
  formatTrainingPriority
} from "../../formatters";
import { PlayerLink } from "../../components/PlayerLink";
import { isSquadSkillRequiredForPosition } from "../../view-models/squad-view-model";
import { PLAYER_SKILL_DEFINITIONS, type PlayerSkillKey } from "../../view-models/player-skills";
import {
  createTrainingPlayerRows,
  TRAINING_POSITIONS,
  type TrainingPlayerRow,
  type TrainingPositionCode
} from "../../view-models/training-view-model";
import type { TrainingProps } from "./types";

const TRAINING_POSITION_TITLES: Record<TrainingPositionCode, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  ATT: "Attacker"
};

interface TrainingPlayerTablesProps {
  configuration: TrainingPageData["configuration"];
  diagnostic: TrainingProps["trainingDiagnostic"];
  history: TrainingReport[];
  onSelectPlayer: (playerId: string) => void;
  players: TrainingPageData["players"];
  projectionSummaries: TrainingProps["projectionSummaries"];
  recommendations: ReadonlyMap<string, string>;
}

export function TrainingPlayerTables({
  configuration,
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
        const positionRows = rows.filter(
          (player) => player.trainingPosition === position.trainingPosition
        );

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
  history: TrainingReport[];
  onSelectPlayer: (playerId: string) => void;
  playerById: Map<string, TrainingPageData["players"][number]>;
  players: TrainingPlayerRow[];
  position: TrainingPositionCode;
  recommendations: ReadonlyMap<string, string>;
}

function TrainingPositionTable({
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
          <col className="is-age" />
          {PLAYER_SKILL_DEFINITIONS.map((skill) => (
            <col className="is-skill" key={skill.key} />
          ))}
          <col className="is-recommendation" />
        </colgroup>
        <thead>
          <tr className="atlas-training-table__group-row">
            <th colSpan={2} scope="colgroup">
              Player
            </th>
            <th colSpan={PLAYER_SKILL_DEFINITIONS.length} scope="colgroup">
              Skills
            </th>
            <th scope="colgroup">Recommendation</th>
          </tr>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Age</th>
            {PLAYER_SKILL_DEFINITIONS.map((skill) => (
              <th
                className={
                  isSquadSkillRequiredForPosition(position, skill.key)
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
              <td className="atlas-training-table__empty" colSpan={11}>
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
            {isDetailsOpen ? "−" : "+"}
          </button>
          <PlayerLink playerId={player.playerId} onSelectPlayer={onSelectPlayer}>
            {player.playerName}
          </PlayerLink>
          <TrainingKind kind={player.trainingKind} />
          <TrainingStatusIndicator status={player.status} />
        </th>
        <td className="atlas-training-table__numeric">{player.age}</td>
        {PLAYER_SKILL_DEFINITIONS.map((skill) => (
          <SkillCell
            change={changes.get(trainingSkillKey(skill.key)) ?? null}
            isImportant={isSquadSkillRequiredForPosition(position, skill.key)}
            key={skill.key}
            skill={skill.key}
            value={skillValue(sourcePlayer?.latestReport?.skills, skill.key)}
          />
        ))}

        <td className="atlas-training-table__recommendation">{recommendation}</td>
      </tr>
      {isDetailsOpen ? (
        <tr className="atlas-training-player-detail-row">
          <td colSpan={11}>
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
                <div>
                  <dt>Training</dt>
                  <dd>
                    {player.trainingType ?? "—"} · {formatTrainingKind(player.trainingKind)} ·{" "}
                    {formatPercentage(player.intensity)}
                  </dd>
                </div>
              </dl>
              <TrainingHistory history={history} />
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
  const marker = change === null ? null : change > 0 ? "↑" : "↓";
  return (
    <td
      className={`atlas-training-table__numeric atlas-training-table__skill${importantClass}${changeClass}`}
      title={change === null ? skill : `${skill} ${change > 0 ? "+" : ""}${change}`}
    >
      <span className="atlas-training-table__skill-value">{value ?? "—"}</span>
      {marker ? (
        <span aria-hidden="true" className="atlas-training-table__skill-marker">
          {marker}
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
      ◆
    </span>
  );
}

function TrainingStatusIndicator({ status }: { status: TrainingPlayerRow["status"] }) {
  if (status === null) return null;

  const icon = status === "Critical" ? "⚠" : status === "Attention" ? "!" : "i";
  return (
    <span
      aria-label={`Training status: ${status}`}
      className={`atlas-training-status-indicator is-${status.toLowerCase()}`}
      title={`Training status: ${status}`}
    >
      {icon}
    </span>
  );
}
function TrainingHistory({ history }: { history: TrainingReport[] }) {
  const recentHistory = [...history]
    .sort((left, right) => right.gameWeek - left.gameWeek)
    .slice(0, 5);
  if (recentHistory.length === 0)
    return <p className="atlas-training-player-detail__message">No training history available.</p>;
  return (
    <div>
      <h3>Training history</h3>
      <ul>
        {recentHistory.map((report) => (
          <li key={`${report.gameWeek}-${report.id ?? report.date}`}>
            Week {report.gameWeek} · {report.type} · {formatTrainingKind(report.kind)} ·{" "}
            {formatPercentage(report.intensity)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function skillValue(
  skills: TrainingReport["skills"] | undefined,
  skill: PlayerSkillKey
): number | undefined {
  const key = trainingSkillKey(skill);
  return skills?.[key] ?? skills?.[skill];
}

function trainingSkillKey(skill: string): string {
  if (skill === "defender") return "defending";
  if (skill === "playmaker") return "playmaking";
  return skill;
}

function formatTrainingKind(kind: TrainingPlayerRow["trainingKind"]): string {
  return kind === null ? "—" : kind.charAt(0).toUpperCase() + kind.slice(1);
}

function skillLabel(skill: number | null): string {
  return skill === null ? "—" : formatTrainingPriority(skill);
}

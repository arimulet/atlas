import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import type { SquadPlanningBundle, SquadRole, TrainingPageData, TrainingReport } from "@atlas/web/app/types";
import {
  formatEta,
  formatNumber,
  formatPercentage,
  formatTalent,
  formatTrainingPriority
} from "@/app/formatters";
import { PlayerLink } from "@/components/PlayerLink";
import { PositionBadge } from "@/components/PositionBadge";
import { isSquadSkillRequiredForPosition } from "@/app/view-models/squad-view-model";
import { createPlayerMarketValueViewModel, formatMarketMoney } from "@/app/view-models/market-value-view-model";
import { SquadPlanningRoleControl } from "@/components/Squad/SquadPlanningRoleControl";
import { TrainingDetails } from "./TrainingDetails";
import { PLAYER_SKILL_DEFINITIONS, type PlayerSkillKey } from "@/app/view-models/player-skills";
import { skillLevelLabel } from "@/app/view-models/skill-level-label";
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
  squadPlanning?: SquadPlanningBundle | null;
  onSaveSquadRole?: (playerId: string, role: SquadRole | null) => Promise<void>;
}

export function TrainingPlayerTables({
  configuration,
  currency,
  diagnostic,
  history,
  onSelectPlayer,
  players,
  projectionSummaries,
  recommendations,
  squadPlanning,
  onSaveSquadRole
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
              <h2 id={`training-position-${position.code}`} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <PositionBadge position={position.code} size="md" />
                <span>
                  {TRAINING_POSITION_TITLES[position.code]} ·{" "}
                  {skillLabel(configuration?.[position.code] ?? null)}
                </span>
              </h2>
              <span>{positionRows.length} players</span>
            </div>
            <TrainingPositionTable
              currency={currency}
              history={history}
              onSaveSquadRole={onSaveSquadRole}
              onSelectPlayer={onSelectPlayer}
              playerById={playerById}
              players={positionRows}
              position={position.code}
              recommendations={recommendations}
              squadPlanning={squadPlanning}
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
  onSaveSquadRole?: (playerId: string, role: SquadRole | null) => Promise<void>;
  onSelectPlayer: (playerId: string) => void;
  playerById: Map<string, TrainingPageData["players"][number]>;
  players: TrainingPlayerRow[];
  position: TrainingPositionCode;
  recommendations: ReadonlyMap<string, string>;
  squadPlanning?: SquadPlanningBundle | null;
}

function TrainingPositionTable({
  currency,
  history,
  onSaveSquadRole,
  onSelectPlayer,
  playerById,
  players,
  position,
  recommendations,
  squadPlanning
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
          <col className="is-market-value" />
          <col className="is-planning" />
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
            <th className="atlas-training-table__col-market-value" scope="col">
              Market Value
            </th>
            <th className="atlas-training-table__col-planning" scope="col">
              Planning
            </th>
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
                onSaveSquadRole={onSaveSquadRole}
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
                squadPlanning={squadPlanning}
              />
            ))
          ) : (
            <tr>
              <td className="atlas-training-table__empty" colSpan={15}>
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
  onSaveSquadRole?: (playerId: string, role: SquadRole | null) => Promise<void>;
  onSelectPlayer: (playerId: string) => void;
  onToggleDetails: () => void;
  recommendation: string;
  player: TrainingPlayerRow;
  position: TrainingPositionCode;
  sourcePlayer: TrainingPageData["players"][number] | null;
  squadPlanning?: SquadPlanningBundle | null;
}

function TrainingPlayerRows({
  currency,
  history,
  isDetailsOpen,
  onSaveSquadRole,
  onSelectPlayer,
  onToggleDetails,
  recommendation,
  player,
  position,
  sourcePlayer,
  squadPlanning
}: TrainingPlayerRowsProps) {
  const changes = new Map(
    player.skillChanges.map((change) => [trainingSkillKey(change.skill), change.delta])
  );
  const depthPlayers = squadPlanning?.assessment.depthPlayers ?? [];
  const depthPlayer =
    depthPlayers.find(
      (candidate) =>
        identifiersMatch(candidate.playerId, player.playerId) ||
        identifiersMatch(candidate.playerId, sourcePlayer?.id)
    ) ?? null;

  const marketValueViewModel = depthPlayer
    ? createPlayerMarketValueViewModel(depthPlayer, currency ?? null)
    : null;

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
          <PlayerLink
            countryName={sourcePlayer?.countryName}
            playerId={player.playerId}
            onSelectPlayer={onSelectPlayer}
          >
            {player.playerName}
          </PlayerLink>
          <TrainingKind kind={player.trainingKind} />
          <TrainingStatusIndicator status={player.status} />
          <TrainingRecommendationIndicator recommendation={recommendation} />
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
        <td className="atlas-training-table__numeric atlas-training-table__market-value">
          {marketValueViewModel?.current.expected.label ?? "—"}
        </td>
        <td className="atlas-training-table__planning">
          {onSaveSquadRole ? (
            <SquadPlanningRoleControl
              onSaveSquadRole={onSaveSquadRole}
              playerId={player.playerId}
              playerName={player.playerName}
              planningPlayer={depthPlayer}
            />
          ) : depthPlayer ? (
            <span className={`atlas-squad-planning-badge is-${depthPlayer.role}`}>
              {depthPlayer.role}
            </span>
          ) : (
            "—"
          )}
        </td>
      </tr>
      {isDetailsOpen ? (
        <tr className="atlas-training-player-detail-row">
          <td colSpan={15}>
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

function identifiersMatch(
  left: string | number | null | undefined,
  right: string | number | null | undefined
): boolean {
  return left !== null && left !== undefined && right !== null && right !== undefined
    ? String(left) === String(right)
    : false;
}

function SkillCell({
  change,
  isImportant,
  skill: _skill,
  value
}: {
  change: number | null;
  isImportant: boolean;
  skill: PlayerSkillKey;
  value: number | undefined | null;
}) {
  const changeClass = change === null ? "" : change > 0 ? " is-skill-up" : " is-skill-down";
  const importantClass = isImportant ? " is-position-skill" : "";
  const levelLabel = skillLevelLabel(value ?? null);
  const tooltipText =
    levelLabel === null
      ? undefined
      : change === null || change === 0
      ? levelLabel
      : `${levelLabel} (${change > 0 ? "+" : ""}${change})`;

  return (
    <td
      className={`atlas-training-table__numeric atlas-training-table__skill${importantClass}${changeClass}`}
      title={tooltipText}
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

function TrainingRecommendationIndicator({
  recommendation
}: {
  recommendation: string | undefined;
}) {
  if (!recommendation) return null;
  const isActionRequired = recommendation.toLowerCase().startsWith("switch");
  if (!isActionRequired) return null;

  return (
    <span
      aria-label={`Recommended action: ${recommendation}`}
      className="atlas-training-recommendation-indicator"
      role="img"
      title={`Recommended action: ${recommendation}`}
    >
      <ArrowRightLeft size={10} />
    </span>
  );
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

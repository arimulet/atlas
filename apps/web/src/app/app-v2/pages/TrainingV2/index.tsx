import { describeDiagnosticFinding } from "@atlas/web/app/diagnostic-copy";
import type { DiagnosticFinding, TrainingPageData, TrainingReport } from "@atlas/web/app/types";
import { formatTrainingPriority } from "@atlas/web/app/formatters";
import type { TrainingPlayerRow, TrainingStatusLabel, TrainingV2Props } from "./types";
import {
  formatV2Eta,
  formatV2Number,
  formatV2Percentage,
  formatV2Talent
} from "../../formatters";
import { V2AttentionIcon } from "../../components/V2AttentionIcon";
import { V2PlayerLink } from "../../components/V2PlayerLink";
import { V2StatusBadge } from "../../components/V2StatusBadge";
import {
  compareDiagnosticSeverity,
  createTrainingPlayerRows,
  TRAINING_POSITIONS
} from "../../view-models/training-view-model";

export function TrainingV2({
  onSelectPlayer,
  projectionSummaries,
  training,
  trainingDiagnostic,
  trainingStatus
}: TrainingV2Props) {
  return (
    <div className="v2-training">
      <header className="v2-training__header">
        <h1>Training</h1>
      </header>

      <TrainingConfiguration configuration={training?.configuration ?? null} />
      <TrainingAttention diagnostic={trainingDiagnostic} status={trainingStatus} />
      <TrainingPositionSections
        configuration={training?.configuration ?? null}
        diagnostic={trainingDiagnostic}
        onSelectPlayer={onSelectPlayer}
        players={training?.players ?? []}
        projectionSummaries={projectionSummaries}
        status={trainingStatus}
      />
      <RecentTrainingProgress history={training?.history ?? []} players={training?.players ?? []} />
    </div>
  );
}

interface TrainingConfigurationProps {
  configuration: TrainingPageData["configuration"];
}

function TrainingConfiguration({ configuration }: TrainingConfigurationProps) {
  return (
    <section className="v2-training-panel" aria-labelledby="training-configuration-title">
      <PanelTitle id="training-configuration-title" title="Training Configuration" />
      {configuration ? (
        <div className="v2-training-configuration">
          {TRAINING_POSITIONS.map((position) => (
            <div className="v2-training-configuration__item" key={position.code}>
              <span className="v2-training-position-badge">{position.code}</span>
              <strong>{skillLabel(configuration[position.code])}</strong>
            </div>
          ))}
        </div>
      ) : (
        <PanelMessage>Training configuration is not available.</PanelMessage>
      )}
    </section>
  );
}

interface TrainingAttentionProps {
  diagnostic: TrainingV2Props["trainingDiagnostic"];
  status: TrainingV2Props["trainingStatus"];
}

function TrainingAttention({ diagnostic, status }: TrainingAttentionProps) {
  const trainingFindings =
    diagnostic?.findings
      .filter((finding) => finding.category === "training-potential")
      .sort(compareDiagnosticSeverity)
      .slice(0, 5) ?? [];

  return (
    <section
      className="v2-training-panel v2-training-panel--attention"
      aria-labelledby="training-attention-title"
    >
      <PanelTitle id="training-attention-title" title="Training Attention" />
      {status === "loading" ? <PanelMessage>Loading diagnostics...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Training diagnostics are unavailable.</PanelMessage>
      ) : null}
      {status === "idle" ? (
        <PanelMessage>Import a club snapshot to inspect training diagnostics.</PanelMessage>
      ) : null}
      {status === "ready" && diagnostic === null ? (
        <PanelMessage>
          Training diagnostics are not available in the current snapshot model.
        </PanelMessage>
      ) : null}
      {status === "ready" && diagnostic !== null && trainingFindings.length === 0 ? (
        <PanelMessage>No training issues detected.</PanelMessage>
      ) : null}
      {status === "ready" && trainingFindings.length > 0 ? (
        <ul className="v2-training-attention-list">
          {trainingFindings.map((finding) => (
            <TrainingAttentionItem
              key={`${finding.code}-${finding.affectedPlayerIds.join("-")}`}
              finding={finding}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

interface TrainingAttentionItemProps {
  finding: DiagnosticFinding;
}

function TrainingAttentionItem({ finding }: TrainingAttentionItemProps) {
  return (
    <li className={`v2-training-attention-item is-${finding.severity}`}>
      <V2AttentionIcon severity={finding.severity} />
      <span>{describeDiagnosticFinding(finding)}</span>
    </li>
  );
}

interface TrainingPositionSectionsProps {
  configuration: TrainingPageData["configuration"];
  diagnostic: TrainingV2Props["trainingDiagnostic"];
  onSelectPlayer: (playerId: string) => void;
  players: TrainingPageData["players"];
  projectionSummaries: TrainingV2Props["projectionSummaries"];
  status: TrainingV2Props["trainingStatus"];
}

function TrainingPositionSections({
  configuration,
  diagnostic,
  onSelectPlayer,
  players,
  projectionSummaries,
  status
}: TrainingPositionSectionsProps) {
  if (status !== "ready") {
    return null;
  }

  const rows = createTrainingPlayerRows(players, diagnostic, projectionSummaries);

  return (
    <div className="v2-training-position-sections">
      {TRAINING_POSITIONS.map((position) => (
        <TrainingPositionSection
          key={position.code}
          onSelectPlayer={onSelectPlayer}
          players={rows.filter((player) => player.trainingPosition === position.trainingPosition)}
          position={position}
          trainedSkill={configuration?.[position.code] ?? null}
        />
      ))}
    </div>
  );
}

interface TrainingPositionSectionProps {
  onSelectPlayer: (playerId: string) => void;
  players: TrainingPlayerRow[];
  position: (typeof TRAINING_POSITIONS)[number];
  trainedSkill: number | null;
}

function TrainingPositionSection({
  onSelectPlayer,
  players,
  position,
  trainedSkill
}: TrainingPositionSectionProps) {
  return (
    <section
      className="v2-training-position-section"
      aria-labelledby={`training-position-${position.code}`}
    >
      <div className="v2-training-position-section__header">
        <h2 id={`training-position-${position.code}`}>
          {position.code} · {skillLabel(trainedSkill)}
        </h2>
        <span>{players.length} players</span>
      </div>
      <TrainingPositionTable onSelectPlayer={onSelectPlayer} players={players} />
    </section>
  );
}

interface TrainingPositionTableProps {
  onSelectPlayer: (playerId: string) => void;
  players: TrainingPlayerRow[];
}

function TrainingPositionTable({ onSelectPlayer, players }: TrainingPositionTableProps) {
  return (
    <div className="v2-training-table-wrap">
      <table className="v2-training-table">
        <colgroup>
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Age</th>
            <th scope="col">Type</th>
            <th scope="col">Kind</th>
            <th scope="col">Intensity</th>
            <th scope="col">Skill Changes</th>
            <th scope="col">Progress</th>
            <th scope="col">Talent</th>
            <th scope="col">Next Skill-up</th>
            <th scope="col">ETA</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {players.length > 0 ? (
            players.map((player) => (
              <PlayerRow key={player.playerId} onSelectPlayer={onSelectPlayer} player={player} />
            ))
          ) : (
            <tr>
              <td className="v2-training-table__empty" colSpan={11}>
                No players assigned.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PlayerRowProps {
  onSelectPlayer: (playerId: string) => void;
  player: TrainingPlayerRow;
}

function PlayerRow({ onSelectPlayer, player }: PlayerRowProps) {
  return (
    <tr>
      <th scope="row">
        <V2PlayerLink playerId={player.playerId} onSelectPlayer={onSelectPlayer}>
          {player.playerName}
        </V2PlayerLink>
      </th>
      <td className="v2-training-table__numeric">{player.age}</td>
      <td>{player.trainingType ?? "—"}</td>
      <td>{player.trainingKind ?? "—"}</td>
      <td className="v2-training-table__numeric">{formatV2Percentage(player.intensity)}</td>
      <td>
        {player.skillChanges.length > 0
          ? player.skillChanges.map((change) => `${change.skill} ${change.delta > 0 ? "+" : ""}${change.delta}`).join(", ")
          : "—"}
      </td>
      <td className="v2-training-table__numeric">{formatV2Percentage(player.progress)}</td>
      <td className="v2-training-table__numeric">{formatV2Talent(player.talent)}</td>
      <td className="v2-training-table__numeric">{formatV2Number(player.nextSkillUp)}</td>
      <td className="v2-training-table__numeric">{formatV2Eta(player.etaWeeks)}</td>
      <td>
        <TrainingStatus status={player.status} />
      </td>
    </tr>
  );
}

interface TrainingStatusProps {
  status: TrainingStatusLabel | null;
}

function TrainingStatus({ status }: TrainingStatusProps) {
  return <V2StatusBadge status={status} />;
}

interface RecentTrainingProgressProps {
  history: TrainingReport[];
  players: TrainingPageData["players"];
}

function RecentTrainingProgress({ history, players }: RecentTrainingProgressProps) {
  const playerNames = new Map(players.map((player) => [player.id, player.name]));
  const changes = history
    .flatMap((report) =>
      Object.entries(report.skillsChange)
        .filter(([skill, delta]) => skill !== "up" && skill !== "down" && delta !== 0)
        .map(([skill, delta]) => ({
          key: `${report.playerId}-${report.gameWeek}-${skill}`,
          playerName: playerNames.get(String(report.playerId)) ?? String(report.playerId),
          skill,
          delta
        }))
    )
    .slice(-10)
    .reverse();

  return (
    <section className="v2-training-panel" aria-labelledby="recent-progress-title">
      <PanelTitle id="recent-progress-title" title="Recent Progress" />
      {changes.length === 0 ? (
        <PanelMessage>No recent skill changes detected.</PanelMessage>
      ) : (
        <ul className="v2-training-attention-list">
          {changes.map((change) => (
            <li className="v2-training-attention-item" key={change.key}>
              <span>
                {change.playerName} · {change.skill} {change.delta > 0 ? "+" : ""}
                {change.delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface PanelTitleProps {
  id: string;
  title: string;
}

function PanelTitle({ id, title }: PanelTitleProps) {
  return (
    <h2 id={id} className="v2-training-panel__title v2-section-title">
      {title}
    </h2>
  );
}

interface PanelMessageProps {
  children: string;
  tone?: "error";
}

function PanelMessage({ children, tone }: PanelMessageProps) {
  return <p className={`v2-training-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

function skillLabel(skill: number | null): string {
  return skill === null ? "\u2014" : formatTrainingSkill(skill);
}

function formatTrainingSkill(skill: number): string {
  return formatTrainingPriority(skill);
}

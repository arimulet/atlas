import { describeDiagnosticFinding } from "@atlas/web/app/diagnostic-copy";
import type { DiagnosticFinding, TrainingPageData } from "@atlas/web/app/types";
import { formatTrainingPriority } from "@atlas/web/app/formatters";
import type { TrainingPlayerRow, TrainingStatusLabel, TrainingV2Props } from "./types";
import {
  compareDiagnosticSeverity,
  createTrainingPlayerRows,
  TRAINING_POSITIONS
} from "../../view-models/training-view-model";
import { createPlayerTrainingProjectionSummaries } from "../../view-models/player-detail-view-model";

export function TrainingV2({
  development,
  onSelectPlayer,
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
        development={development}
        onSelectPlayer={onSelectPlayer}
        players={training?.players ?? []}
        status={trainingStatus}
        training={training}
      />
      <RecentTrainingProgress />
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
      <span aria-hidden="true">{attentionIcon(finding.severity)}</span>
      <span>{describeDiagnosticFinding(finding)}</span>
    </li>
  );
}

interface TrainingPositionSectionsProps {
  configuration: TrainingPageData["configuration"];
  diagnostic: TrainingV2Props["trainingDiagnostic"];
  development: TrainingV2Props["development"];
  onSelectPlayer: (playerId: string) => void;
  players: TrainingPageData["players"];
  status: TrainingV2Props["trainingStatus"];
  training: TrainingPageData | null;
}

function TrainingPositionSections({
  configuration,
  diagnostic,
  development,
  onSelectPlayer,
  players,
  status,
  training
}: TrainingPositionSectionsProps) {
  if (status !== "ready") {
    return null;
  }

  const projectionSummaries = createPlayerTrainingProjectionSummaries({
    development,
    training,
    trainingDiagnostic: diagnostic,
    trainingStatus: status
  });
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
            <th scope="col">Advanced</th>
            <th scope="col">Minutes</th>
            <th scope="col">Efficiency</th>
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
              <td className="v2-training-table__empty" colSpan={10}>
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
        <button
          className="v2-training-player-link"
          type="button"
          onClick={() => onSelectPlayer(player.playerId)}
        >
          {player.playerName}
        </button>
      </th>
      <td className="v2-training-table__numeric">{player.age}</td>
      <td>
        <span
          className={`v2-training-advanced${player.advanced ? " is-active" : ""}`}
          aria-label={player.advanced ? "Advanced training" : "No advanced training"}
        >
          {player.advanced ? "\u2713" : "\u2014"}
        </span>
      </td>
      <td className="v2-training-table__numeric">{formatNumber(player.minutes)}</td>
      <td className="v2-training-table__numeric">{formatPercentage(player.efficiency)}</td>
      <td className="v2-training-table__numeric">{formatPercentage(player.progress)}</td>
      <td className="v2-training-table__numeric">{formatTalent(player.talent)}</td>
      <td className="v2-training-table__numeric">{formatNumber(player.nextSkillUp)}</td>
      <td className="v2-training-table__numeric">{formatEta(player.etaWeeks)}</td>
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
  return (
    <span className={`v2-training-status${status ? ` is-${status.toLowerCase()}` : " is-empty"}`}>
      {status ?? "\u2014"}
    </span>
  );
}

function formatNumber(value: number | null): string {
  return value === null ? "\u2014" : value.toLocaleString("en-US");
}

function formatPercentage(value: number | null): string {
  return value === null
    ? "\u2014"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function formatTalent(value: number | null): string {
  return value === null ? "\u2014" : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatEta(value: number | null): string {
  if (value === null) {
    return "\u2014";
  }

  if (value < 1) {
    return "<1w";
  }

  return `~${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}w`;
}

function RecentTrainingProgress() {
  return (
    <section className="v2-training-panel" aria-labelledby="recent-progress-title">
      <PanelTitle id="recent-progress-title" title="Recent Progress" />
      <PanelMessage>No recent skill-ups detected.</PanelMessage>
    </section>
  );
}

interface PanelTitleProps {
  id: string;
  title: string;
}

function PanelTitle({ id, title }: PanelTitleProps) {
  return (
    <h2 id={id} className="v2-training-panel__title">
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
  return skill === null ? "Not set" : formatTrainingSkill(skill);
}

function attentionIcon(severity: DiagnosticFinding["severity"]): string {
  return severity === "info" || severity === "low" ? "ℹ" : "⚠";
}

function formatTrainingSkill(skill: number): string {
  return formatTrainingPriority(skill);
}

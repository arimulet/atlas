import { describeDiagnosticFinding } from "@atlas/web/app/diagnostic-copy";
import type { PlayerDetailV2Props } from "./types";
import { ProjectionPanel } from "./ProjectionPanel";
import { TalentPanel } from "./TalentPanel";
import {
  createPlayerDetailViewModel,
  type PlayerDetailViewModel
} from "../../view-models/player-detail-view-model";

export function PlayerDetailV2({
  development,
  onBack,
  playerId,
  training,
  trainingDiagnostic,
  trainingStatus
}: PlayerDetailV2Props) {
  const viewModel = createPlayerDetailViewModel({
    playerId,
    training,
    development,
    trainingDiagnostic,
    trainingStatus
  });

  if (!viewModel) {
    return (
      <div className="v2-player-detail">
        <button className="v2-player-detail__back" type="button" onClick={onBack}>
          ← Back
        </button>
        <section className="v2-player-detail-panel">
          <p className="v2-player-detail__message">Player data is not available.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="v2-player-detail">
      <PlayerHeader player={viewModel.player} training={viewModel.training} onBack={onBack} />
      <PlayerAttention
        diagnosticAvailable={trainingDiagnostic !== null}
        diagnostics={viewModel.diagnostics}
        status={trainingStatus}
      />
      <div className="v2-player-detail__summary-grid">
        <SkillsPanel skills={viewModel.skills} />
        <TrainingPanel training={viewModel.training} />
      </div>
      <div className="v2-player-detail__secondary-grid">
        <TalentPanel talent={viewModel.talent} />
        <ProjectionPanel projection={viewModel.projection} training={viewModel.training} />
      </div>
      <ProgressPanel rows={viewModel.recentSkillUps} />
      <TrainingHistoryPanel rows={viewModel.trainingHistory} />
    </div>
  );
}

interface PlayerHeaderProps {
  player: PlayerDetailViewModel["player"];
  training: PlayerDetailViewModel["training"];
  onBack: () => void;
}

function PlayerHeader({ onBack, player, training }: PlayerHeaderProps) {
  return (
    <header className="v2-player-detail__header">
      <button className="v2-player-detail__back" type="button" onClick={onBack}>
        ← Back
      </button>
      <h1>{player.name}</h1>
      <p>
        {player.age} · {training.position ?? "—"} · {training.trainedSkill ?? "—"}
        {training.advanced ? " · Advanced" : ""}
      </p>
    </header>
  );
}

interface PlayerAttentionProps {
  diagnosticAvailable: boolean;
  diagnostics: PlayerDetailViewModel["diagnostics"];
  status: PlayerDetailV2Props["trainingStatus"];
}

function PlayerAttention({ diagnosticAvailable, diagnostics, status }: PlayerAttentionProps) {
  const unavailableMessage =
    status === "loading"
      ? "Loading diagnostics..."
      : status === "error"
        ? "Training diagnostics are unavailable."
        : status === "idle"
          ? "Import a club snapshot to inspect player diagnostics."
          : "Player diagnostics are not available in the current snapshot model.";

  return (
    <section className="v2-player-detail-panel v2-player-detail-panel--attention">
      <PanelTitle title="Player Attention" />
      {status !== "ready" || !diagnosticAvailable ? (
        <p className="v2-player-detail__message">{unavailableMessage}</p>
      ) : diagnostics.length > 0 ? (
        <ul className="v2-player-detail__attention-list">
          {diagnostics.map((finding) => (
            <li className={`is-${finding.severity}`} key={`${finding.code}-${finding.severity}`}>
              <span aria-hidden="true">{attentionIcon(finding.severity)}</span>
              <span>{describeDiagnosticFinding(finding)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="v2-player-detail__message v2-player-detail__message--quiet">
          ✓ No issues requiring attention
        </p>
      )}
    </section>
  );
}

interface SkillsPanelProps {
  skills: PlayerDetailViewModel["skills"];
}

function SkillsPanel({ skills }: SkillsPanelProps) {
  return (
    <section className="v2-player-detail-panel" aria-labelledby="player-detail-skills-title">
      <PanelTitle id="player-detail-skills-title" title="Skills" />
      <dl className="v2-player-detail__skills-grid">
        {skills.map((skill) => (
          <div key={skill.key}>
            <dt>{skill.label}</dt>
            <dd>{skill.value === null ? "—" : skill.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface TrainingPanelProps {
  training: PlayerDetailViewModel["training"];
}

function TrainingPanel({ training }: TrainingPanelProps) {
  return (
    <section className="v2-player-detail-panel" aria-labelledby="player-detail-training-title">
      <PanelTitle id="player-detail-training-title" title="Training" />
      <dl className="v2-player-detail__data-list">
        <DataRow label="Position" value={training.position ?? "—"} />
        <DataRow label="Trained Skill" value={training.trainedSkill ?? "—"} />
        <DataRow label="Advanced" value={training.advanced ? "✓ Yes" : "—"} />
        <DataRow label="Minutes" value={formatNumber(training.minutes)} />
        <DataRow label="Efficiency" value={formatPercentage(training.efficiency)} />
        <DataRow label="Progress" value={formatPercentage(training.progress)} />
        <DataRow label="Status" value={training.status ?? "—"} />
      </dl>
    </section>
  );
}

interface ProgressPanelProps {
  rows: PlayerDetailViewModel["recentSkillUps"];
}

function ProgressPanel({ rows }: ProgressPanelProps) {
  return (
    <section className="v2-player-detail-panel" aria-labelledby="player-detail-progress-title">
      <PanelTitle id="player-detail-progress-title" title="Recent Progress" />
      {rows.length === 0 ? (
        <p className="v2-player-detail__message">No recent skill-ups detected.</p>
      ) : (
        <div className="v2-player-detail__table-wrap">
          <table className="v2-player-detail__table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Skill</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.date}-${row.skill}-${row.toLevel}`}>
                  <td>{row.date ?? "—"}</td>
                  <th scope="row">{row.skill}</th>
                  <td>
                    {row.fromLevel} → {row.toLevel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface TrainingHistoryPanelProps {
  rows: PlayerDetailViewModel["trainingHistory"];
}

function TrainingHistoryPanel({ rows }: TrainingHistoryPanelProps) {
  return (
    <section className="v2-player-detail-panel" aria-labelledby="player-detail-history-title">
      <PanelTitle id="player-detail-history-title" title="Training History" />
      {rows.length === 0 ? (
        <p className="v2-player-detail__message">No training history available.</p>
      ) : null}
    </section>
  );
}

interface PanelTitleProps {
  id?: string;
  title: string;
}

function PanelTitle({ id, title }: PanelTitleProps) {
  return (
    <h2 className="v2-player-detail-panel__title" id={id}>
      {title}
    </h2>
  );
}

interface DataRowProps {
  label: string;
  value: string | number;
}

function DataRow({ label, value }: DataRowProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatNumber(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

function formatPercentage(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function attentionIcon(severity: PlayerDetailViewModel["diagnostics"][number]["severity"]): string {
  return severity === "info" || severity === "low" ? "ℹ" : "⚠";
}

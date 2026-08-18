import type { DiagnosticFinding, DiagnosticParameterValue } from "@atlas/web/app/types";
import type { PlayerDetailProps } from "./types";
import { ProjectionPanel } from "./ProjectionPanel";
import { TalentPanel } from "./TalentPanel";
import { formatDateTime, formatNumber, formatPercentage } from "../../formatters";
import { AttentionIcon } from "../../components/AttentionIcon";
import { StatusBadge } from "../../components/StatusBadge";
import {
  createPlayerDetailViewModel,
  type PlayerDetailViewModel
} from "../../view-models/player-detail-view-model";

export function PlayerDetail({
  development,
  onBack,
  playerId,
  training,
  trainingDiagnostic,
  trainingStatus,
  onBackToSquad
}: PlayerDetailProps) {
  const viewModel = createPlayerDetailViewModel({
    playerId,
    training,
    development,
    trainingDiagnostic,
    trainingStatus
  });

  if (!viewModel) {
    const isLoading = trainingStatus === "loading";

    return (
      <div className="atlas-player-detail">
        <button
          className="atlas-player-detail__back"
          type="button"
          onClick={isLoading ? onBack : onBackToSquad}
        >
          {isLoading ? "← Back" : "Back to Squad"}
        </button>
        <section className="atlas-player-detail-panel">
          <p className="atlas-player-detail__message">
            {isLoading ? "Loading player..." : "Player not found."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="atlas-player-detail">
      <PlayerHeader player={viewModel.player} training={viewModel.training} onBack={onBack} />
      <PlayerAttention
        diagnosticAvailable={trainingDiagnostic !== null}
        diagnostics={viewModel.diagnostics}
        status={trainingStatus}
      />
      <div className="atlas-player-detail__summary-grid">
        <SkillsPanel skills={viewModel.skills} />
        <TrainingPanel training={viewModel.training} />
      </div>
      <div className="atlas-player-detail__secondary-grid">
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
    <header className="atlas-player-detail__header">
      <button className="atlas-player-detail__back" type="button" onClick={onBack}>
        ← Back
      </button>
      <h1>{player.name}</h1>
      <p>
        {player.age} · {training.position ?? "—"} · {training.trainedSkill ?? "—"}
        {training.trainingKind ? ` · ${training.trainingKind}` : ""}
      </p>
    </header>
  );
}

interface PlayerAttentionProps {
  diagnosticAvailable: boolean;
  diagnostics: PlayerDetailViewModel["diagnostics"];
  status: PlayerDetailProps["trainingStatus"];
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
    <section className="atlas-player-detail-panel atlas-player-detail-panel--attention">
      <PanelTitle title="Player Attention" />
      {status !== "ready" || !diagnosticAvailable ? (
        <p className="atlas-player-detail__message">{unavailableMessage}</p>
      ) : diagnostics.length > 0 ? (
        <ul className="atlas-player-detail__attention-list">
          {diagnostics.map((finding) => (
            <li className={`is-${finding.severity}`} key={`${finding.code}-${finding.severity}`}>
              <AttentionIcon severity={finding.severity} />
              <span>{describePlayerFinding(finding)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="atlas-player-detail__message atlas-player-detail__message--quiet">
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
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-skills-title">
      <PanelTitle id="player-detail-skills-title" title="Skills" />
      <dl className="atlas-player-detail__skills-grid">
        {skills.map((skill) => (
          <div key={skill.key}>
            <dt>{skill.label}</dt>
            <dd>{formatNumber(skill.value)}</dd>
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
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-training-title">
      <PanelTitle id="player-detail-training-title" title="Training" />
      <dl className="atlas-player-detail__data-list">
        <DataRow label="Position" value={training.position ?? "—"} />
        <DataRow label="Trained Skill" value={training.trainedSkill ?? "—"} />
        <DataRow label="Training type" value={training.trainingType ?? "—"} />
        <DataRow label="Training kind" value={training.trainingKind ?? "—"} />
        <DataRow label="Intensity" value={formatPercentage(training.intensity)} />
        <DataRow label="Progress" value={formatPercentage(training.progress)} />
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={training.status} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

interface ProgressPanelProps {
  rows: PlayerDetailViewModel["recentSkillUps"];
}

function ProgressPanel({ rows }: ProgressPanelProps) {
  return (
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-progress-title">
      <PanelTitle id="player-detail-progress-title" title="Recent Progress" />
      {rows.length === 0 ? (
        <p className="atlas-player-detail__message">No recent skill-ups detected.</p>
      ) : (
        <div className="atlas-player-detail__table-wrap">
          <table className="atlas-player-detail__table">
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
                  <td>{formatDateTime(row.date)}</td>
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
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-history-title">
      <PanelTitle id="player-detail-history-title" title="Training History" />
      {rows.length === 0 ? (
        <p className="atlas-player-detail__message">No training history available.</p>
      ) : (
        <div className="atlas-player-detail__table-wrap">
          <table className="atlas-player-detail__table">
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col">Type</th>
                <th scope="col">Kind</th>
                <th scope="col">Intensity</th>
                <th scope="col">Skill Changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.week}>
                  <th scope="row">W{row.week}</th>
                  <td>{row.type}</td>
                  <td>{row.kind}</td>
                  <td>{row.intensity}%</td>
                  <td>
                    {row.skillChanges.length === 0
                      ? "—"
                      : row.skillChanges
                          .map((change) => `${change.skill} ${change.before} → ${change.after}`)
                          .join(", ")}
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

interface PanelTitleProps {
  id?: string;
  title: string;
}

function PanelTitle({ id, title }: PanelTitleProps) {
  return (
    <h2 className="atlas-player-detail-panel__title atlas-section-title" id={id}>
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

const roleLabels: Record<string, string> = {
  goalkeeper: "arquero",
  defender: "defensor",
  midfielder: "mediocampista",
  winger: "extremo",
  striker: "delantero"
};

function describePlayerFinding(finding: DiagnosticFinding): string {
  const parameters = finding.parameters ?? {};

  if (finding.code.startsWith("squad-balance.") && finding.code.endsWith(".deficit")) {
    return (
      "La plantilla tiene " +
      formatDiagnosticNumber(parameters.currentCount) +
      " jugador(es) en " +
      diagnosticRoleLabel(parameters.role) +
      "; el mínimo de referencia es " +
      formatDiagnosticNumber(parameters.minimum) +
      "."
    );
  }

  switch (finding.code) {
    case "economic-risk.high-wage-low-value-ratio":
      return (
        diagnosticStringValue(parameters.playerName) +
        " tiene un salario alto (" +
        formatDiagnosticNumber(parameters.wage) +
        ") en relación con su valor estimado (" +
        formatDiagnosticNumber(parameters.value) +
        ")."
      );
    case "asset-risk.senior-high-value":
      return (
        diagnosticStringValue(parameters.playerName) +
        " combina una edad senior con un valor estimado relevante (" +
        formatDiagnosticNumber(parameters.value) +
        ")."
      );
    case "training-potential.young-role-fit":
      return diagnosticStringValue(parameters.playerName) + " es joven y muestra un buen ajuste para su rol.";
    case "follow-up.incomplete-player-data":
      return (
        diagnosticStringValue(parameters.playerName) +
        " requiere seguimiento porque sus datos importados están incompletos."
      );
    default:
      return finding.code;
  }
}

function diagnosticRoleLabel(value: DiagnosticParameterValue | undefined): string {
  return roleLabels[diagnosticStringValue(value)] ?? diagnosticStringValue(value);
}

function diagnosticStringValue(value: DiagnosticParameterValue | undefined): string {
  return value === null || value === undefined ? "dato no disponible" : String(value);
}

function formatDiagnosticNumber(value: DiagnosticParameterValue | undefined): string {
  return typeof value === "number"
    ? value.toLocaleString("es-AR")
    : diagnosticStringValue(value);
}

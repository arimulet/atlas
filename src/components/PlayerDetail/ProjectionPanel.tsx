import { AlertCircle, AlertTriangle } from "lucide-react";
import type { PlayerDetailViewModel } from "@/app/view-models/player-detail-view-model";
import { skillLevelLabel } from "@/app/view-models/skill-level-label";
import { formatNumber } from "@/app/formatters";
import { TalentPanel } from "./TalentPanel";
import { StatusBadge } from "@/components/StatusBadge";

interface ProjectionPanelProps {
  projection: PlayerDetailViewModel["projection"];
  talent: PlayerDetailViewModel["talent"];
  training: PlayerDetailViewModel["training"];
}

export function ProjectionPanel({ projection, talent, training }: ProjectionPanelProps) {
  return (
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-projection-title">
      <div className="atlas-player-detail__projection-header">
        <h2
          className="atlas-player-detail-panel__title atlas-section-title"
          id="player-detail-projection-title"
        >
          Potential Projection
        </h2>
        <StatusBadge status={training.status} />
      </div>
      <TalentPanel talent={talent} />
      <TrainingSignalSummary status={training.status} />

      <TrainingProgressTrajectory projection={projection} />

      {projection.horizon ? (
        <div className="atlas-player-detail__projection-section">
          <h3>In {projection.horizon.weeks} weeks</h3>
          <dl className="atlas-player-detail__data-list">
            <DataRow
              label={projection.current.skill ?? "Skill"}
              value={formatNumber(projection.horizon.projectedLevel)}
              title={skillLevelLabel(projection.horizon.projectedLevel) ?? undefined}
            />
          </dl>
        </div>
      ) : null}

      {!projection.nextSkillUp && !projection.horizon ? (
        <p className="atlas-player-detail__message atlas-player-detail__message--quiet">
          Not enough data to project future progress.
        </p>
      ) : null}
    </section>
  );
}

function TrainingProgressTrajectory({
  projection
}: {
  projection: PlayerDetailViewModel["projection"];
}) {
  const currentLevel = projection.current.level;
  const nextSkillUp = projection.nextSkillUp;
  const progress = projection.current.progress;
  const progressValue = progress === null ? 0 : Math.min(100, Math.max(0, progress));

  return (
    <div className="atlas-player-detail__projection-trajectory">
      <div className="atlas-player-detail__projection-trajectory-heading">
        <span>Training now</span>
        <strong>{projection.current.skill ?? "—"}</strong>
      </div>
      <div className="atlas-player-detail__projection-levels">
        <div>
          <span>Current</span>
          <strong title={skillLevelLabel(currentLevel) ?? undefined}>
            {formatSkillLevel(currentLevel)}
          </strong>
        </div>
        <div className="atlas-player-detail__projection-level-connector" aria-hidden="true" />
        <div className="is-next">
          <span>Next skill-up</span>
          <strong title={skillLevelLabel(nextSkillUp?.targetLevel ?? null) ?? undefined}>
            {formatSkillLevel(nextSkillUp?.targetLevel ?? null)}
          </strong>
        </div>
      </div>
      <div
        className="atlas-player-detail__projection-progress"
        aria-label="Progress to next skill-up"
      >
        <div className="atlas-player-detail__projection-progress-track">
          <span style={{ width: `${progressValue}%` }} />
        </div>
        <div className="atlas-player-detail__projection-progress-summary">
          <strong>{formatProgress(progress)}</strong>
          <span>
            {nextSkillUp
              ? formatEstimatedWeeks(nextSkillUp.estimatedWeeks)
              : "Next skill-up unavailable"}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatSkillLevel(level: number | null): string {
  const levelLabel = skillLevelLabel(level);
  const formattedLevel = formatNumber(level);

  return levelLabel ? `${formattedLevel} (${levelLabel})` : formattedLevel;
}

function formatProgress(value: number | null): string {
  return value === null ? "—" : `${Math.floor(value)}%`;
}

function formatEstimatedWeeks(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const weeks = Math.max(0, Math.floor(value));
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

function TrainingSignalSummary({
  status
}: {
  status: PlayerDetailViewModel["training"]["status"];
}) {
  if (status === "Attention" || status === "Critical") {
    return (
      <p className="atlas-player-detail__training-signal is-warning">
        {status === "Critical" ? (
          <>
            <AlertTriangle size={14} /> Critical training warning.
          </>
        ) : (
          <>
            <AlertCircle size={14} /> Training requires review.
          </>
        )}
      </p>
    );
  }

  return null;
}

interface DataRowProps {
  label: string;
  value: string | number;
  title?: string;
}

function DataRow({ label, value, title }: DataRowProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd title={title}>{value}</dd>
    </div>
  );
}

import type { PlayerDetailViewModel } from "../../view-models/player-detail-view-model";
import { formatEta, formatNumber, formatPercentage } from "../../formatters";
import { TalentPanel } from "./TalentPanel";
import { StatusBadge } from "../../components/StatusBadge";

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
      <p className="atlas-player-detail__projection-assumption">Assuming current training</p>

      <div className="atlas-player-detail__projection-section">
        <h3>Current</h3>
        <dl className="atlas-player-detail__data-list">
          <DataRow label="Skill" value={projection.current.skill ?? "—"} />
          <DataRow label="Level" value={formatNumber(projection.current.level)} />
          <DataRow label="Progress" value={formatPercentage(projection.current.progress)} />
        </dl>
      </div>

      <div className="atlas-player-detail__projection-section">
        <h3>Next skill-up</h3>
        {projection.nextSkillUp ? (
          <dl className="atlas-player-detail__data-list">
            <DataRow
              label={projection.current.skill ?? "Skill"}
              value={formatNumber(projection.nextSkillUp.targetLevel)}
            />
            <DataRow
              label="Estimated weeks"
              value={formatEta(projection.nextSkillUp.estimatedWeeks)}
            />
          </dl>
        ) : (
          <p className="atlas-player-detail__message">Next skill-up —</p>
        )}
      </div>

      {projection.horizon ? (
        <div className="atlas-player-detail__projection-section">
          <h3>In {projection.horizon.weeks} weeks</h3>
          <dl className="atlas-player-detail__data-list">
            <DataRow
              label={projection.current.skill ?? "Skill"}
              value={formatNumber(projection.horizon.projectedLevel)}
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

function TrainingSignalSummary({
  status
}: {
  status: PlayerDetailViewModel["training"]["status"];
}) {
  if (status === "Training prospect") {
    return (
      <p className="atlas-player-detail__training-signal is-prospect">
        ✦ Training prospect: young player with a strong role fit.
      </p>
    );
  }

  if (status === "Attention" || status === "Critical") {
    return (
      <p className="atlas-player-detail__training-signal is-warning">
        {status === "Critical" ? "⚠ Critical training warning." : "! Training requires review."}
      </p>
    );
  }

  return null;
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

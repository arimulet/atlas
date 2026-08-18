import type { PlayerDetailViewModel } from "../../view-models/player-detail-view-model";
import {
  formatEta,
  formatNumber,
  formatPercentage
} from "../../formatters";

interface ProjectionPanelProps {
  projection: PlayerDetailViewModel["projection"];
  training: PlayerDetailViewModel["training"];
}

export function ProjectionPanel({ projection, training }: ProjectionPanelProps) {
  return (
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-projection-title">
      <h2
        className="atlas-player-detail-panel__title atlas-section-title"
        id="player-detail-projection-title"
      >
        Projection
      </h2>
      <p className="atlas-player-detail__projection-assumption">Assuming current training</p>
      <dl className="atlas-player-detail__data-list">
        <DataRow label="Position" value={training.position ?? "—"} />
        <DataRow label="Trained Skill" value={training.trainedSkill ?? "—"} />
        <DataRow label="Training type" value={training.trainingType ?? "—"} />
        <DataRow label="Training kind" value={training.trainingKind ?? "—"} />
        <DataRow label="Intensity" value={formatPercentage(training.intensity)} />
      </dl>

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

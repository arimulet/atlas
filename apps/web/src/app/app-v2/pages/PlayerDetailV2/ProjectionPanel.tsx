import type { PlayerDetailViewModel } from "../../view-models/player-detail-view-model";
import {
  formatV2Eta,
  formatV2Number,
  formatV2Percentage
} from "../../formatters";

interface ProjectionPanelProps {
  projection: PlayerDetailViewModel["projection"];
  training: PlayerDetailViewModel["training"];
}

export function ProjectionPanel({ projection, training }: ProjectionPanelProps) {
  return (
    <section className="v2-player-detail-panel" aria-labelledby="player-detail-projection-title">
      <h2
        className="v2-player-detail-panel__title v2-section-title"
        id="player-detail-projection-title"
      >
        Projection
      </h2>
      <p className="v2-player-detail__projection-assumption">Assuming current training</p>
      <dl className="v2-player-detail__data-list">
        <DataRow label="Position" value={training.position ?? "—"} />
        <DataRow label="Trained Skill" value={training.trainedSkill ?? "—"} />
        <DataRow label="Training type" value={training.trainingType ?? "—"} />
        <DataRow label="Training kind" value={training.trainingKind ?? "—"} />
        <DataRow label="Intensity" value={formatV2Percentage(training.intensity)} />
      </dl>

      <div className="v2-player-detail__projection-section">
        <h3>Current</h3>
        <dl className="v2-player-detail__data-list">
          <DataRow label="Skill" value={projection.current.skill ?? "—"} />
          <DataRow label="Level" value={formatV2Number(projection.current.level)} />
          <DataRow label="Progress" value={formatV2Percentage(projection.current.progress)} />
        </dl>
      </div>

      <div className="v2-player-detail__projection-section">
        <h3>Next skill-up</h3>
        {projection.nextSkillUp ? (
          <dl className="v2-player-detail__data-list">
            <DataRow
              label={projection.current.skill ?? "Skill"}
              value={formatV2Number(projection.nextSkillUp.targetLevel)}
            />
            <DataRow
              label="Estimated weeks"
              value={formatV2Eta(projection.nextSkillUp.estimatedWeeks)}
            />
          </dl>
        ) : (
          <p className="v2-player-detail__message">Next skill-up —</p>
        )}
      </div>

      {projection.horizon ? (
        <div className="v2-player-detail__projection-section">
          <h3>In {projection.horizon.weeks} weeks</h3>
          <dl className="v2-player-detail__data-list">
            <DataRow
              label={projection.current.skill ?? "Skill"}
              value={formatV2Number(projection.horizon.projectedLevel)}
            />
          </dl>
        </div>
      ) : null}

      {!projection.nextSkillUp && !projection.horizon ? (
        <p className="v2-player-detail__message v2-player-detail__message--quiet">
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

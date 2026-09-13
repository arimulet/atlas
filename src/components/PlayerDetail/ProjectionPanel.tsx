import { AlertCircle, AlertTriangle, Sparkles } from "lucide-react";
import type { PlayerDetailViewModel } from "@/app/view-models/player-detail-view-model";
import { skillLevelLabel } from "@/app/view-models/skill-level-label";
import { formatEta, formatNumber, formatPercentage } from "@/app/formatters";
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
      <p className="atlas-player-detail__projection-assumption">Assuming current training</p>

      <div className="atlas-player-detail__projection-section">
        <h3>Current</h3>
        <dl className="atlas-player-detail__data-list">
          <DataRow label="Skill" value={projection.current.skill ?? "—"} />
          <DataRow
            label="Level"
            value={formatNumber(projection.current.level)}
            title={skillLevelLabel(projection.current.level) ?? undefined}
          />
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
              title={skillLevelLabel(projection.nextSkillUp.targetLevel) ?? undefined}
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

function TrainingSignalSummary({
  status
}: {
  status: PlayerDetailViewModel["training"]["status"];
}) {
  if (status === "Training prospect") {
    return (
      <p className="atlas-player-detail__training-signal is-prospect">
        <Sparkles size={14} /> Training prospect: young player with a strong role fit.
      </p>
    );
  }

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

import { useState, type ReactNode } from "react";
import type { PlayerDevelopmentTargetOverride } from "@atlas/domain";
import { formatEta, formatPercentage } from "../../formatters";
import {
  type DevelopmentPlanPathRow,
  type DevelopmentPlanTargetRow,
  type DevelopmentPlanViewModel
} from "./development-plan-view-model";
import { EditDevelopmentTargetModal } from "./EditDevelopmentTargetModal";

interface PlayerDevelopmentPlanProps {
  plan: DevelopmentPlanViewModel | null;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  onUpdateTarget: (override: PlayerDevelopmentTargetOverride) => Promise<void>;
  onResetToAutomatic: () => Promise<void>;
}

export function PlayerDevelopmentPlan({
  plan,
  isLoading,
  isSaving,
  error,
  onUpdateTarget,
  onResetToAutomatic
}: PlayerDevelopmentPlanProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  if (isLoading && plan === null) {
    return (
      <section className="atlas-player-detail-panel">
        <PanelTitle title="Development Plan" />
        <p className="atlas-player-detail__message">Loading development plan...</p>
      </section>
    );
  }

  if (plan === null) {
    return (
      <section className="atlas-player-detail-panel">
        <PanelTitle title="Development Plan" />
        <p className="atlas-player-detail__message">No development target defined.</p>
      </section>
    );
  }

  const handleSave = async (override: PlayerDevelopmentTargetOverride) => {
    await onUpdateTarget(override);
    setIsEditorOpen(false);
  };

  return (
    <section
      className="atlas-player-detail-panel atlas-player-development-plan"
      aria-labelledby="player-development-plan-title"
    >
      <div className="atlas-player-development-plan__header">
        <PanelTitle id="player-development-plan-title" title="Development Plan" />
        <button
          className="atlas-player-development-plan__edit"
          type="button"
          onClick={() => setIsEditorOpen(true)}
        >
          Edit target
        </button>
      </div>
      {error ? (
        <p className="atlas-player-detail__message atlas-player-detail__message--warning">
          {error.message}
        </p>
      ) : null}
      <ProfileSummary plan={plan} />
      <ProgressSummary plan={plan} />
      <div className="atlas-player-development-plan__highlight-grid">
        <NextStep plan={plan} />
        <CompletionSummary plan={plan} />
      </div>
      <TrainingAlignment plan={plan} />
      <Warnings plan={plan} />
      <SkillTargets targets={plan.targets} title="Recommended target / Target operativo" />
      <TrainingPath path={plan.path} completed={plan.completed} />
      <Milestones plan={plan} />
      <details className="atlas-player-development-plan__ideal-profile">
        <summary>Ideal profile target (Long-term reference)</summary>
        <p className="atlas-player-development-plan__ideal-note">
          This is a long-term reference profile and not a direct recommendation for immediate training.
        </p>
        <SkillTargets targets={plan.idealTargets} title="Ideal Target" />
      </details>
      {isEditorOpen ? (
        <EditDevelopmentTargetModal
          plan={plan}
          isSaving={isSaving}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSave}
          onReset={onResetToAutomatic}
        />
      ) : null}
    </section>
  );
}

function ProfileSummary({ plan }: { plan: DevelopmentPlanViewModel }) {
  return (
    <div className="atlas-player-development-plan__profile">
      <div>
        <span className="atlas-player-development-plan__eyebrow">Profile</span>
        <strong>{plan.profile.currentLabel}</strong>
        <span className="atlas-badge">{plan.profile.source === "manual" ? "Manual target" : "Automatic target"}</span>
      </div>
      <div>
        <span className="atlas-player-development-plan__eyebrow">Operational Target Summary</span>
        <p>
          {plan.progress.remainingLevels} pending skill-ups ·{" "}
          {plan.completion.estimatedWeeks !== null ? formatEta(plan.completion.estimatedWeeks) : "Unknown timeframe"} ·{" "}
          {plan.completion.estimatedAge !== null ? `Age ~${plan.completion.estimatedAge.toLocaleString("en-US", { maximumFractionDigits: 1 })}` : "Unknown age"}
        </p>
      </div>
      {plan.profile.hasConflict ? (
        <p>
          ATLAS suggestion: {plan.profile.suggestedLabel} ·{" "}
          {capitalize(plan.profile.suggestionConfidence)} confidence
        </p>
      ) : null}
    </div>
  );
}

function ProgressSummary({ plan }: { plan: DevelopmentPlanViewModel }) {
  return (
    <div className="atlas-player-development-plan__progress-block">
      <div className="atlas-player-development-plan__section-heading">
        <h3>Development progress</h3>
        <strong>{formatPercentage(plan.progress.percentage)}</strong>
      </div>
      <div
        className="atlas-player-development-plan__progress"
        aria-label={`Development progress ${formatPercentage(plan.progress.percentage)}`}
      >
        <span style={{ width: `${Math.min(plan.progress.percentage, 100)}%` }} />
      </div>
      <p>
        {plan.progress.totalLevels === 0
          ? "No target skill levels defined."
          : `${plan.progress.completedLevels} of ${plan.progress.totalLevels} target skill levels completed`}
      </p>
    </div>
  );
}

function NextStep({ plan }: { plan: DevelopmentPlanViewModel }) {
  const step = plan.nextStep;
  return (
    <article className="atlas-player-development-plan__highlight">
      <span className="atlas-player-development-plan__eyebrow">Next training step</span>
      {step ? (
        <>
          <strong>{skillLabel(step.skill)}</strong>
          <span>
            {step.fromLevel} → {step.toLevel}
          </span>
          <small>{formatEta(step.estimatedWeeks)}</small>
          <p>{step.reasons[0] ?? "Next best step in the generated path."}</p>
        </>
      ) : (
        <strong>{plan.completed ? "Development target completed" : "No step available"}</strong>
      )}
    </article>
  );
}

function CompletionSummary({ plan }: { plan: DevelopmentPlanViewModel }) {
  return (
    <article className="atlas-player-development-plan__highlight">
      <span className="atlas-player-development-plan__eyebrow">Projected completion</span>
      {plan.completion.estimatedWeeks !== null ? (
        <>
          <strong>{formatEta(plan.completion.estimatedWeeks)}</strong>
          <span>
            {plan.completion.estimatedAge === null
              ? "Age unavailable"
              : `Age ~${plan.completion.estimatedAge.toLocaleString("en-US", { maximumFractionDigits: 1 })}`}
          </span>
          <span>
            {plan.completion.estimatedGameWeek === null
              ? "Game Week unavailable"
              : `Game Week ${plan.completion.estimatedGameWeek}`}
          </span>
        </>
      ) : (
        <strong>Timeline unavailable</strong>
      )}
      {plan.projectionStatus === "partial" ? (
        <span className="atlas-player-development-plan__partial">
          Partial timeline — long-term projection unavailable.
        </span>
      ) : null}
      <small>{capitalize(plan.completion.confidence)} confidence</small>
      <details>
        <summary>Assumptions</summary>
        <p>
          {capitalize(plan.assumptions.trainingKind)} training ·{" "}
          {plan.assumptions.expectedIntensity}% intensity ·{" "}
          {plan.assumptions.assumeContinuousTraining
            ? "continuous training"
            : "non-continuous training"}
        </p>
      </details>
    </article>
  );
}

function TrainingAlignment({ plan }: { plan: DevelopmentPlanViewModel }) {
  const alignment = plan.weeklyTrainingAlignment;

  if (alignment.status === "unavailable") {
    return null;
  }

  if (alignment.status === "aligned") {
    return (
      <p className="atlas-player-development-plan__alignment is-aligned">
        Current training aligned with plan · {skillLabel(alignment.plannedSkill!)}
      </p>
    );
  }

  return (
    <div className="atlas-player-development-plan__alignment is-mismatch" role="note">
      <strong>Training mismatch</strong>
      <span>Development Plan recommends: {skillLabel(alignment.plannedSkill!)}</span>
      <span>Current training: {skillLabel(alignment.currentSkill!)}</span>
    </div>
  );
}

function Warnings({ plan }: { plan: DevelopmentPlanViewModel }) {
  return plan.warnings.length > 0 ? (
    <div className="atlas-player-development-plan__warnings" role="note">
      {plan.warnings.slice(0, 2).map((warning) => (
        <span key={warning.code}>{warning.label}</span>
      ))}
    </div>
  ) : null;
}

function SkillTargets({ targets, title }: { targets: DevelopmentPlanTargetRow[], title: string }) {
  return (
    <PlanSection title={title}>
      <div className="atlas-player-detail__table-wrap">
        <table className="atlas-player-detail__table">
          <thead>
            <tr>
              <th>Skill</th>
              <th>Current</th>
              <th>Target</th>
              <th>Remaining</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => (
              <tr key={target.skill}>
                <th>{skillLabel(target.skill)}</th>
                <td>{target.currentLevel}</td>
                <td>{target.targetLevel}</td>
                <td>{target.remaining}</td>
                <td>{capitalize(target.priority)}</td>
                <td>{statusLabel(target.status)}</td>
                <td>{target.reasons.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlanSection>
  );
}

function TrainingPath({ path, completed }: { path: DevelopmentPlanPathRow[]; completed: boolean }) {
  const [showFullPath, setShowFullPath] = useState(false);
  const visiblePath = showFullPath ? path : path.slice(0, 7);
  return (
    <PlanSection title="Training path">
      <p className="atlas-player-development-plan__path-note">
        {completed
          ? "Target path completed."
          : "Current step is highlighted; future steps are recalculated from the current state."}
      </p>
      {path.length === 0 ? (
        <p className="atlas-player-detail__message">No pending skill-ups.</p>
      ) : (
        <div className="atlas-player-development-plan__path">
          {visiblePath.map((step) => (
            <div className={step.isCurrent ? "is-current" : ""} key={step.order}>
              <b>{step.order}</b>
              <strong>{skillLabel(step.skill)}</strong>
              <span>
                {step.fromLevel} → {step.toLevel}
              </span>
              <span>{formatEta(step.estimatedWeeks)}</span>
              <small>
                {step.cumulativeWeeks === null ? "—" : `~${step.cumulativeWeeks.toFixed(1)}w`}
              </small>
            </div>
          ))}
        </div>
      )}
      {path.length > 7 ? (
        <button
          className="atlas-player-development-plan__show-more"
          type="button"
          onClick={() => setShowFullPath((visible) => !visible)}
        >
          {showFullPath ? "Show less" : "Show full path"}
        </button>
      ) : null}
    </PlanSection>
  );
}

function Milestones({ plan }: { plan: DevelopmentPlanViewModel }) {
  return (
    <PlanSection title="Milestones">
      {plan.milestones.length === 0 ? (
        <p className="atlas-player-detail__message">
          Milestones will appear as the path is projected.
        </p>
      ) : (
        <ol className="atlas-player-development-plan__milestones">
          {plan.milestones.map((milestone) => (
            <li key={`${milestone.type}-${milestone.step}`}>
              <strong>GW {milestone.estimatedGameWeek}</strong>
              <span>{milestone.label}</span>
              <small>
                {milestone.estimatedAge === null
                  ? "Age unavailable"
                  : `Age ~${milestone.estimatedAge.toLocaleString("en-US", { maximumFractionDigits: 1 })}`}{" "}
                · {capitalize(milestone.confidence)}
              </small>
            </li>
          ))}
        </ol>
      )}
    </PlanSection>
  );
}

function PlanSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="atlas-player-development-plan__section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function PanelTitle({ id, title }: { id?: string; title: string }) {
  return (
    <h2 className="atlas-player-detail-panel__title atlas-section-title" id={id}>
      {title}
    </h2>
  );
}

function skillLabel(skill: DevelopmentPlanPathRow["skill"]): string {
  const labels: Record<DevelopmentPlanPathRow["skill"], string> = {
    stamina: "Stamina",
    pace: "Pace",
    technique: "Technique",
    passing: "Passing",
    keeper: "Keeper",
    defender: "Defending",
    playmaker: "Playmaking",
    striker: "Scoring"
  };
  return labels[skill];
}

function statusLabel(status: DevelopmentPlanTargetRow["status"]): string {
  return status === "complete" ? "Complete" : status === "in_progress" ? "In progress" : "Pending";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

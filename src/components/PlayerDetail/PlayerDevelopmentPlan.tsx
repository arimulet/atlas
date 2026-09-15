import React, { useState, type ReactNode } from "react";
import { ArrowRight, Award, TrendingUp, Clock, Target, ArrowUpRight } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { getSokkerSeason, normalizeSeasonWeek, type PlayerDevelopmentTargetOverride } from "@atlas/domain";
import { formatEta, formatPercentage } from "@/app/formatters";
import { skillLevelLabel } from "@/app/view-models/skill-level-label";
import {
  type DevelopmentPlanPathRow,
  type DevelopmentPlanTargetRow,
  type DevelopmentPlanViewModel
} from "./development-plan-view-model";
import { EditDevelopmentTargetModal } from "./EditDevelopmentTargetModal";

interface PlayerDevelopmentPlanProps {
  plan: DevelopmentPlanViewModel | null;
  marketValue: import("@/app/view-models/market-value-view-model").PlayerMarketValueViewModel | null;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  onUpdateTarget: (override: PlayerDevelopmentTargetOverride) => Promise<void>;
  onResetToAutomatic: () => Promise<void>;
}

export function PlayerDevelopmentPlan({
  plan,
  marketValue,
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
      <DevelopmentImpactDashboard plan={plan} marketValue={marketValue} />
      {marketValue?.projection?.points && marketValue.projection.points.length > 0 && (
        <MarketProjectionChart points={marketValue.projection.points} />
      )}
      <TrainingAlignment plan={plan} />
      <Warnings plan={plan} />
      <UnifiedTrainingPath path={plan.path} completed={plan.completed} marketValue={marketValue} milestones={plan.milestones} />
      <SkillTargets targets={plan.targets} idealTargets={plan.idealTargets} title="Target operativo e Ideal" />
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
          {plan.completion.estimatedAge !== null ? `Age ~${plan.completion.estimatedAge}` : "Unknown age"}
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

function SkillTargets({ targets, idealTargets, title }: { targets: DevelopmentPlanTargetRow[], idealTargets: DevelopmentPlanTargetRow[], title: string }) {
  return (
    <PlanSection title={title}>
      <div className="atlas-player-detail__table-wrap">
        <table className="atlas-player-detail__table">
          <thead>
            <tr>
              <th>Skill</th>
              <th>Current</th>
              <th>Operative Target</th>
              <th>Ideal Target</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => {
              const ideal = idealTargets.find(t => t.skill === target.skill);
              return (
                <tr key={target.skill}>
                  <th>{skillLabel(target.skill)}</th>
                  <td title={skillLevelLabel(target.currentLevel) ?? undefined}>{target.currentLevel}</td>
                  <td title={skillLevelLabel(target.targetLevel) ?? undefined}>
                    {target.targetLevel} <small className="atlas-text-muted">({target.remaining} left)</small>
                  </td>
                  <td title={ideal ? skillLevelLabel(ideal.targetLevel) ?? undefined : undefined}>
                    {ideal ? `${ideal.targetLevel} ` : "—"}
                    {ideal ? <small className="atlas-text-muted">({ideal.remaining} left)</small> : null}
                  </td>
                  <td>{capitalize(target.priority)}</td>
                  <td>{statusLabel(target.status)}</td>
                  <td>{target.reasons.join(", ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PlanSection>
  );
}

function UnifiedTrainingPath({ 
  path, 
  completed, 
  marketValue,
  milestones
}: { 
  path: DevelopmentPlanPathRow[]; 
  completed: boolean;
  marketValue: import("@/app/view-models/market-value-view-model").PlayerMarketValueViewModel | null;
  milestones: import("./development-plan-view-model").DevelopmentPlanMilestoneRow[];
}) {
  const visiblePath = path;
  const initialMilestones = milestones.filter(m => m.step === 0);

  return (
    <PlanSection title="Development & Financial Trajectory">
      <p className="atlas-player-development-plan__path-note">
        {completed
          ? "Target path completed."
          : "Current step is highlighted; future steps are recalculated from the current state."}
      </p>
      {path.length === 0 && initialMilestones.length === 0 ? (
        <p className="atlas-player-detail__message">No pending skill-ups.</p>
      ) : (
        <div className="atlas-player-development-plan__path-table-wrap" style={{ overflowX: "auto" }}>
          {initialMilestones.length > 0 ? (
            <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "var(--atlas-surface-alt)", borderRadius: "var(--atlas-radius-md)" }}>
              {initialMilestones.map(milestone => (
                <div key={milestone.type} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Award size={16} style={{ color: "var(--atlas-primary)" }} />
                  <strong>GW {milestone.estimatedGameWeek}</strong>
                  <span>{milestone.label}</span>
                  <small className="atlas-text-muted">
                    {milestone.estimatedAge === null ? "" : `(Age ~${milestone.estimatedAge.toLocaleString("en-US", { maximumFractionDigits: 1 })})`}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
          <table className="atlas-player-detail__table">
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Skill Progression</th>
                <th scope="col">Timeline</th>
                {marketValue ? (
                  <>
                    <th scope="col">Projected Value</th>
                    <th scope="col">Expected Gain</th>
                    <th scope="col">Gain / Wk</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visiblePath.map((step) => {
                const projPoint = marketValue?.projection?.points.find(p => p.step === step.order);
                const efficiencyStep = marketValue?.training?.steps.find(s => s.step === step.order);
                const stepMilestones = milestones.filter(m => m.step === step.order);

                return (
                  <tr key={step.order} className={step.isCurrent ? "is-current" : ""}>
                    <th scope="row"><b>{step.order}</b></th>
                    <td>
                      <div>
                        <strong>{skillLabel(step.skill)}</strong>{" "}
                        <span title={skillLevelLabel(step.fromLevel) ?? undefined}>{step.fromLevel}</span>{" "}
                        <ArrowRight size={13} className="inline-block align-middle" />{" "}
                        <span title={skillLevelLabel(step.toLevel) ?? undefined}>{step.toLevel}</span>
                      </div>
                      {stepMilestones.map(m => (
                        <div key={m.type} style={{ marginTop: '4px', fontSize: '0.85em', color: 'var(--atlas-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Award size={14} />
                          <span>{m.label}</span>
                        </div>
                      ))}
                    </td>
                    <td>
                      <div>
                        {step.estimatedWeeks !== null ? `+${step.estimatedWeeks} weeks` : "—"}
                      </div>
                      <small className="atlas-text-muted">
                        {step.estimatedGameWeek !== null ? `${step.estimatedAge ? Math.floor(step.estimatedAge) + " yo" : "S" + getSokkerSeason(step.estimatedGameWeek)} · W${normalizeSeasonWeek(step.estimatedGameWeek)}` : "—"}
                      </small>
                    </td>
                    {marketValue ? (
                      <>
                        <td>{projPoint?.value.label ?? "—"}</td>
                        <td className={efficiencyStep?.valueGain?.value && efficiencyStep.valueGain.value < 0 ? "atlas-text-danger" : "atlas-text-success"}>
                          {efficiencyStep?.valueGain?.label ?? "—"}
                        </td>
                        <td className={efficiencyStep?.valueGainPerWeek?.value && efficiencyStep.valueGainPerWeek.value < 0 ? "atlas-text-danger" : "atlas-text-success"}>
                          {efficiencyStep?.valueGainPerWeek?.label ?? "—"}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

function DevelopmentImpactDashboard({ 
  plan, 
  marketValue 
}: { 
  plan: DevelopmentPlanViewModel, 
  marketValue: import("@/app/view-models/market-value-view-model").PlayerMarketValueViewModel | null 
}) {
  return (
    <div className="atlas-player-development-plan__impact-dashboard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--atlas-surface-alt)', padding: '1rem', borderRadius: 'var(--atlas-radius-md)' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--atlas-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Time to Target</span>
        <strong style={{ fontSize: '1.1rem' }}>
          {plan.completion.estimatedWeeks !== null ? formatEta(plan.completion.estimatedWeeks) : "Unknown"}
        </strong>
          {plan.completion.estimatedAge !== null && (
            <small style={{ color: 'var(--atlas-text-muted)' }}>Age ~{plan.completion.estimatedAge}</small>
          )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--atlas-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={14} /> Value Created</span>
        <strong style={{ fontSize: '1.1rem', color: marketValue?.training?.totalValueGain?.value && marketValue.training.totalValueGain.value < 0 ? 'var(--atlas-danger)' : 'var(--atlas-success)' }}>
          {marketValue?.training?.totalValueGain?.label ?? "—"}
        </strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--atlas-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={14} /> Average Gain / Wk</span>
        <strong style={{ fontSize: '1.1rem', color: marketValue?.training?.averageValueGainPerWeek?.value && marketValue.training.averageValueGainPerWeek.value < 0 ? 'var(--atlas-danger)' : 'var(--atlas-success)' }}>
          {marketValue?.training?.averageValueGainPerWeek?.label ?? "—"}
        </strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--atlas-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowUpRight size={14} /> Projected Peak</span>
        <strong style={{ fontSize: '1.1rem' }}>
          {marketValue?.projection?.peak?.value.label ?? "—"}
        </strong>
        {marketValue?.projection?.peak?.age && (
          <small style={{ color: 'var(--atlas-text-muted)' }}>Age {marketValue.projection.peak.age}</small>
        )}
      </div>
    </div>
  );
}

function MarketProjectionChart({ points }: { points: import("@/app/view-models/market-value-view-model").ProjectionPointViewModel[] }) {
  if (points.length === 0) return null;

  const data = points.map((point) => ({
    label: point.label,
    value: point.value.value,
    valueLabel: point.value.label,
    rangeLabel: point.range?.label ?? null,
    age: point.age,
    weeks: point.weeks,
    confidence: point.confidence.label
  }));

  return (
    <div className="atlas-market-value__chart-wrap" style={{ height: '300px', marginBottom: '2rem' }}>
      <div
        className="atlas-market-value__chart"
        role="img"
        aria-label="Estimated market value by development milestone"
        style={{ width: '100%', height: '100%' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--atlas-border)" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              stroke="var(--atlas-text-muted)"
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tickFormatter={formatCompactValue}
              width={58}
              stroke="var(--atlas-text-muted)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--atlas-surface)",
                border: "1px solid var(--atlas-border)",
                borderRadius: "var(--atlas-radius-sm)"
              }}
              formatter={(value) => [formatMarketProjectionValue(value), "Estimated value"]}
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload;
                if (data && data.age) {
                  return `${label} (Age ${data.age})`;
                }
                return label;
              }}
              labelStyle={{ color: "var(--atlas-text)", fontWeight: 500, marginBottom: 4 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="Estimated value"
              stroke="var(--atlas-accent)"
              strokeWidth={3}
              dot={{
                fill: "var(--atlas-surface)",
                r: 4,
                stroke: "var(--atlas-accent)",
                strokeWidth: 3
              }}
              activeDot={{
                fill: "var(--atlas-surface)",
                r: 6,
                stroke: "var(--atlas-accent)",
                strokeWidth: 3
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatCompactValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatMarketProjectionValue(value: unknown): string {
  if (typeof value === "number") {
    return value.toLocaleString("en-US");
  }

  return typeof value === "string" ? value : "?";
}

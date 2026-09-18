import React, { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Award,
  TrendingUp,
  Clock,
  Target,
  ArrowUpRight,
  Star,
  Trophy,
  DollarSign,
  User,
  Sparkles,
  CircleDashed,
  HelpCircle
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { normalizeSeasonWeek, type PlayerDevelopmentTargetOverride } from "@atlas/domain";
import { formatEta } from "@/app/formatters";
import { skillLevelLabel } from "@/app/view-models/skill-level-label";
import {
  type DevelopmentPlanPathRow,
  type DevelopmentPlanTargetRow,
  type DevelopmentPlanViewModel
} from "./development-plan-view-model";
import { EditDevelopmentTargetModal } from "./EditDevelopmentTargetModal";

interface PlayerDevelopmentPlanProps {
  plan: DevelopmentPlanViewModel | null;
  marketValue:
    import("@/app/view-models/market-value-view-model").PlayerMarketValueViewModel | null;
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <PanelTitle id="player-development-plan-title" title="Development Plan" />
          {plan.assumptions?.trainingKind ? (
            <span
              title={
                plan.assumptions.trainingKind === "advanced"
                  ? "Advanced Training"
                  : plan.assumptions.trainingKind === "formation"
                    ? "Standard Training"
                    : "Training"
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color:
                  plan.assumptions.trainingKind === "advanced"
                    ? "var(--atlas-success, #059669)"
                    : "var(--atlas-text-muted)",
                cursor: "help"
              }}
              aria-label={
                plan.assumptions.trainingKind === "advanced"
                  ? "Advanced Training"
                  : plan.assumptions.trainingKind === "formation"
                    ? "Standard Training"
                    : "Training"
              }
            >
              {plan.assumptions.trainingKind === "advanced" ? (
                <Sparkles size={16} />
              ) : plan.assumptions.trainingKind === "formation" ? (
                <CircleDashed size={16} />
              ) : null}
            </span>
          ) : null}
        </div>
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
      <DevelopmentImpactDashboard plan={plan} marketValue={marketValue} />
      {marketValue?.projection?.points && marketValue.projection.points.length > 0 && (
        <MarketProjectionChart points={marketValue.projection.points} path={plan.path} />
      )}
      <TrainingAlignment plan={plan} />
      <Warnings plan={plan} />
      <UnifiedTrainingPath
        path={plan.path}
        completed={plan.completed}
        marketValue={marketValue}
        milestones={plan.milestones}
      />
      <SkillTargets
        targets={plan.targets}
        idealTargets={plan.idealTargets}
        title="Operative & Ideal Targets"
      />
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

function TrainingAlignment({ plan }: { plan: DevelopmentPlanViewModel }) {
  const alignment = plan.weeklyTrainingAlignment;

  if (alignment.status !== "mismatch") {
    return null;
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
  const visibleWarnings = plan.warnings.filter(
    (warning) =>
      warning.code !== "intensity_assumed" &&
      warning.code !== "advanced_training_assumed" &&
      warning.code !== "formation_training_assumed" &&
      warning.code !== "low_talent_confidence" &&
      warning.code !== "long_term_projection" &&
      warning.code !== "unknown_current_sublevel"
  );
  return visibleWarnings.length > 0 ? (
    <div className="atlas-player-development-plan__warnings" role="note">
      {visibleWarnings.slice(0, 2).map((warning) => (
        <span key={warning.code}>{warning.label}</span>
      ))}
    </div>
  ) : null;
}

function SkillTargets({
  targets,
  idealTargets,
  title
}: {
  targets: DevelopmentPlanTargetRow[];
  idealTargets: DevelopmentPlanTargetRow[];
  title: string;
}) {
  return (
    <PlanSection title={title}>
      <div className="atlas-player-detail__table-wrap">
        <table className="atlas-player-detail__table">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Current</th>
              <th scope="col">Operative Target</th>
              <th scope="col">Ideal Target</th>
              <th scope="col">Status</th>
              <th scope="col">Reasons</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => {
              const ideal = idealTargets.find((t) => t.skill === target.skill);
              const currentLevelLabel = skillLevelLabel(target.currentLevel);
              const operativeLevelLabel = skillLevelLabel(target.targetLevel);
              const idealLevelLabel = ideal ? skillLevelLabel(ideal.targetLevel) : null;

              return (
                <tr key={target.skill}>
                  <th
                    scope="row"
                    style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--atlas-text)" }}
                  >
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                      <PriorityIcon priority={target.priority} />
                      <span>{skillLabel(target.skill)}</span>
                    </div>
                  </th>
                  <td
                    title={
                      currentLevelLabel
                        ? `${target.currentLevel} - ${currentLevelLabel}`
                        : undefined
                    }
                  >
                    <strong style={{ fontSize: "0.88rem" }}>{target.currentLevel}</strong>
                  </td>
                  <td
                    title={
                      operativeLevelLabel
                        ? `${target.targetLevel} - ${operativeLevelLabel}`
                        : undefined
                    }
                  >
                    <strong style={{ fontSize: "0.88rem" }}>{target.targetLevel}</strong>{" "}
                    <small className="atlas-text-muted">({target.remaining} left)</small>
                  </td>
                  <td
                    title={
                      idealLevelLabel && ideal
                        ? `${ideal.targetLevel} - ${idealLevelLabel}`
                        : undefined
                    }
                  >
                    {ideal ? (
                      <>
                        <strong style={{ fontSize: "0.88rem" }}>{ideal.targetLevel}</strong>{" "}
                        <small className="atlas-text-muted">({ideal.remaining} left)</small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <StatusBadgeForTarget status={target.status} />
                  </td>
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

function PriorityIcon({ priority }: { priority: DevelopmentPlanTargetRow["priority"] }) {
  const config = getPriorityConfig(priority);
  const Icon = config.icon;
  const tooltip = `${capitalize(priority)} priority`;

  return (
    <span
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        color: config.color,
        cursor: "help"
      }}
      aria-label={tooltip}
    >
      <Icon size={14} />
    </span>
  );
}

function getPriorityConfig(priority: DevelopmentPlanTargetRow["priority"]) {
  switch (priority) {
    case "primary":
      return {
        icon: Star,
        color: "var(--atlas-warning, #d97706)"
      };
    case "secondary":
      return {
        icon: TrendingUp,
        color: "var(--atlas-accent, #2563eb)"
      };
    case "supporting":
    default:
      return {
        icon: Award,
        color: "var(--atlas-text-muted, #6b7280)"
      };
  }
}

function StatusBadgeForTarget({ status }: { status: DevelopmentPlanTargetRow["status"] }) {
  const config = getTargetStatusBadgeConfig(status);
  const label =
    status === "complete" ? "Complete" : status === "in_progress" ? "In progress" : "Pending";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "var(--atlas-radius-sm, 4px)",
        fontSize: "0.72rem",
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`
      }}
    >
      {label}
    </span>
  );
}

function getTargetStatusBadgeConfig(status: DevelopmentPlanTargetRow["status"]) {
  switch (status) {
    case "complete":
      return {
        bg: "rgba(16, 185, 129, 0.12)",
        color: "var(--atlas-success, #059669)",
        border: "rgba(16, 185, 129, 0.3)"
      };
    case "in_progress":
      return {
        bg: "rgba(37, 99, 235, 0.12)",
        color: "var(--atlas-accent, #2563eb)",
        border: "rgba(37, 99, 235, 0.3)"
      };
    default:
      return {
        bg: "rgba(107, 114, 128, 0.12)",
        color: "var(--atlas-text-muted, #6b7280)",
        border: "rgba(107, 114, 128, 0.3)"
      };
  }
}

function getMilestoneConfig(
  type: import("./development-plan-view-model").DevelopmentPlanMilestoneRow["type"]
) {
  switch (type) {
    case "skill_target_completed":
      return {
        icon: Target,
        color: "var(--atlas-info, #0284c7)"
      };
    case "primary_skills_completed":
      return {
        icon: Star,
        color: "var(--atlas-warning, #d97706)"
      };
    case "development_target_completed":
      return {
        icon: Trophy,
        color: "var(--atlas-success, #059669)"
      };
    default:
      return {
        icon: Award,
        color: "var(--atlas-primary)"
      };
  }
}

function UnifiedTrainingPath({
  path,
  completed: _completed,
  marketValue,
  milestones
}: {
  path: DevelopmentPlanPathRow[];
  completed: boolean;
  marketValue:
    import("@/app/view-models/market-value-view-model").PlayerMarketValueViewModel | null;
  milestones: import("./development-plan-view-model").DevelopmentPlanMilestoneRow[];
}) {
  const visiblePath = path;
  const initialMilestones = milestones.filter((m) => m.step === 0);

  return (
    <PlanSection title="Development & Financial Trajectory">
      {path.length === 0 && initialMilestones.length === 0 ? (
        <p className="atlas-player-detail__message">No pending skill-ups.</p>
      ) : (
        <div
          className="atlas-player-development-plan__path-table-wrap"
          style={{ overflowX: "auto" }}
        >
          {initialMilestones.length > 0 ? (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                backgroundColor: "var(--atlas-surface-alt)",
                borderRadius: "var(--atlas-radius-md)"
              }}
            >
              {initialMilestones.map((milestone) => {
                const config = getMilestoneConfig(milestone.type);
                const Icon = config.icon;
                return (
                  <div
                    key={milestone.type}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    <span
                      title={milestone.label}
                      style={{ display: "inline-flex", alignItems: "center" }}
                    >
                      <Icon size={16} style={{ color: config.color }} />
                    </span>
                    <strong>GW {milestone.estimatedGameWeek}</strong>
                    <span>{milestone.label}</span>
                    <small className="atlas-text-muted">
                      {milestone.estimatedAge === null
                        ? ""
                        : `(Age ~${milestone.estimatedAge.toLocaleString("en-US", { maximumFractionDigits: 1 })})`}
                    </small>
                  </div>
                );
              })}
            </div>
          ) : null}
          <table className="atlas-player-detail__table">
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Skill Progression</th>
                <th scope="col">Timeline</th>
                {marketValue ? <th scope="col">Projected Value</th> : null}
              </tr>
            </thead>
            <tbody>
              {visiblePath.map((step) => {
                const projPoint = marketValue?.projection?.points.find(
                  (p) => p.step === step.order
                );
                const efficiencyStep = marketValue?.training?.steps.find(
                  (s) => s.step === step.order
                );
                const stepMilestones = milestones.filter((m) => m.step === step.order);

                return (
                  <tr key={step.order} className={step.isCurrent ? "is-current" : ""}>
                    <th scope="row">
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                        <b>{step.order}</b>
                        {stepMilestones.map((m) => {
                          const config = getMilestoneConfig(m.type);
                          const Icon = config.icon;
                          return (
                            <span
                              key={m.type}
                              title={m.label}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                color: config.color,
                                cursor: "help"
                              }}
                              aria-label={m.label}
                            >
                              <Icon size={14} />
                            </span>
                          );
                        })}
                      </div>
                    </th>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                        <strong>{skillLabel(step.skill)}</strong>{" "}
                        <span title={skillLevelLabel(step.fromLevel) ?? undefined}>
                          {step.fromLevel}
                        </span>{" "}
                        <ArrowRight size={13} className="inline-block align-middle" />{" "}
                        <span title={skillLevelLabel(step.toLevel) ?? undefined}>
                          {step.toLevel}
                        </span>
                        {step.hasUnknownSublevel ? (
                          <span
                            title="Initial sublevel not recorded; conservative estimate is used"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              color: "var(--atlas-warning, #d97706)",
                              cursor: "help",
                              marginLeft: "0.2rem"
                            }}
                            aria-label="Initial sublevel conservatively estimated"
                          >
                            <HelpCircle size={13} />
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          whiteSpace: "nowrap"
                        }}
                      >
                        <strong>
                          {step.estimatedWeeks !== null ? `+${step.estimatedWeeks} weeks` : "—"}
                        </strong>
                        {step.estimatedAge ? (
                          <>
                            <span className="atlas-text-muted">·</span>
                            <span>{Math.floor(step.estimatedAge)} yo</span>
                          </>
                        ) : null}
                        {step.estimatedGameWeek !== null ? (
                          <>
                            <span className="atlas-text-muted">·</span>
                            <span className="atlas-text-muted">
                              W{normalizeSeasonWeek(step.estimatedGameWeek)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </td>
                    {marketValue ? (
                      <td>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            whiteSpace: "nowrap"
                          }}
                        >
                          <strong
                            style={{
                              fontSize: "0.88rem",
                              fontWeight: 700,
                              color: "var(--atlas-text)"
                            }}
                          >
                            {projPoint?.value.label ?? "—"}
                          </strong>
                          {efficiencyStep?.valueGain ? (
                            <span
                              style={{
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                color:
                                  efficiencyStep.valueGain.value > 0
                                    ? "var(--atlas-success, #059669)"
                                    : efficiencyStep.valueGain.value < 0
                                      ? "var(--atlas-danger, #dc2626)"
                                      : "var(--atlas-text-muted)"
                              }}
                            >
                              ({efficiencyStep.valueGain.label})
                            </span>
                          ) : null}
                        </div>
                      </td>
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function DevelopmentImpactDashboard({
  plan,
  marketValue
}: {
  plan: DevelopmentPlanViewModel;
  marketValue:
    import("@/app/view-models/market-value-view-model").PlayerMarketValueViewModel | null;
}) {
  const peakStep = marketValue?.projection?.peak?.step;
  const totalGain =
    peakStep === undefined
      ? null
      : (marketValue?.projection?.points.find((point) => point.step === peakStep)
          ?.gainFromCurrent ?? null);
  const isLoss = (totalGain?.value ?? 0) < 0;

  return (
    <div
      className="atlas-player-development-plan__impact-dashboard"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
        backgroundColor: "var(--atlas-surface-alt)",
        padding: "1rem",
        borderRadius: "var(--atlas-radius-md)"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--atlas-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <User size={14} /> Profile
        </span>
        <strong style={{ fontSize: "1.1rem" }}>{plan.profile.currentLabel}</strong>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "2px",
            flexWrap: "wrap"
          }}
        >
          <span className="atlas-badge" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
            {plan.profile.source === "manual" ? "Manual target" : "Automatic target"}
          </span>
          {plan.profile.hasConflict && (
            <small
              style={{ color: "var(--atlas-warning, #d97706)" }}
              title={`ATLAS suggestion: ${plan.profile.suggestedLabel}`}
            >
              (Conflict)
            </small>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--atlas-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <DollarSign size={14} /> Current Value
        </span>
        <strong style={{ fontSize: "1.1rem" }}>
          {marketValue?.current?.expected?.label ?? "—"}
        </strong>
        {marketValue?.current?.range?.label && (
          <small style={{ color: "var(--atlas-text-muted)" }}>
            {marketValue.current.range.label}
          </small>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--atlas-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <Clock size={14} /> Time to Target
        </span>
        <strong style={{ fontSize: "1.1rem" }}>
          {plan.completion.estimatedWeeks !== null
            ? formatEta(plan.completion.estimatedWeeks, { unit: "long" })
            : "Unknown"}
        </strong>
        {plan.completion.estimatedAge !== null && (
          <small style={{ color: "var(--atlas-text-muted)" }}>
            Age ~{plan.completion.estimatedAge}
          </small>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--atlas-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <ArrowUpRight size={14} /> Projected Peak
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "1.1rem" }}>
            {marketValue?.projection?.peak?.value.label ?? "—"}
          </strong>
          {totalGain?.label && (
            <span
              style={{
                color: isLoss ? "#ef4444" : "#10b981",
                fontWeight: 600,
                fontSize: "0.85rem"
              }}
            >
              ({totalGain.label})
            </span>
          )}
        </div>
        {marketValue?.projection?.peak?.range?.label && (
          <small style={{ color: "var(--atlas-text-muted)" }}>
            {marketValue.projection.peak.range.label}
          </small>
        )}
      </div>
    </div>
  );
}

function MarketProjectionChart({
  points,
  path
}: {
  points: import("@/app/view-models/market-value-view-model").ProjectionPointViewModel[];
  path: DevelopmentPlanPathRow[];
}) {
  if (points.length === 0) return null;

  const currencySymbol = marketCurrencySymbol(points);
  const pathByStep = new Map(path.map((step) => [step.order, step]));

  const data = points.map((point) => {
    const trainingStep = pathByStep.get(point.step);
    const trainedSkillLabel = trainingStep
      ? `${skillLabel(trainingStep.skill)} ${trainingStep.fromLevel} → ${trainingStep.toLevel}`
      : null;

    return {
      label: trainingStep ? `Step ${point.step} · ${skillLabel(trainingStep.skill)}` : point.label,
      tooltipLabel: trainedSkillLabel ? `${point.label} · ${trainedSkillLabel}` : point.label,
      value: point.value.value,
      valueLabel: point.value.label,
      rangeLabel: point.range?.label ?? null,
      timelineLabel: projectionTimelineLabel(point.age, point.weeks),
      confidence: point.confidence.label
    };
  });

  return (
    <div
      className="atlas-market-value__chart-wrap"
      style={{ height: "300px", marginBottom: "2rem" }}
    >
      <div
        className="atlas-market-value__chart"
        role="img"
        aria-label="Estimated market value by development milestone"
        style={{ width: "100%", height: "100%" }}
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
              tickFormatter={(value) => formatCompactValue(value, currencySymbol)}
              width={58}
              stroke="var(--atlas-text-muted)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--atlas-surface)",
                border: "1px solid var(--atlas-border)",
                borderRadius: "var(--atlas-radius-sm)"
              }}
              formatter={(_value, _name, item) => [item.payload.valueLabel, "Estimated value"]}
              labelFormatter={(_label, payload) => {
                const data = payload?.[0]?.payload;
                if (data?.timelineLabel) {
                  return `${data.tooltipLabel} · ${data.timelineLabel}`;
                }
                return data?.tooltipLabel ?? "";
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

function projectionTimelineLabel(age: string, weeks: number | null): string {
  const displayedAge = age === "—" ? "Age unavailable" : `Age ${age.replace(/^~/, "")}`;

  if (weeks === null) return displayedAge;

  return `${displayedAge} · ${weeks.toLocaleString("en-US", { maximumFractionDigits: 1 })} weeks`;
}

function marketCurrencySymbol(
  points: import("@/app/view-models/market-value-view-model").ProjectionPointViewModel[]
): string {
  const label = points.find((point) => point.value.label !== "—")?.value.label;
  return label?.replace(/[0-9.,\s-]/g, "") ?? "";
}

function formatCompactValue(value: number, currencySymbol: string): string {
  const compactValue = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);

  return `${currencySymbol}${compactValue}`;
}

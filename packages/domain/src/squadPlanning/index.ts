import {
  BASE_TRAINING_AGE,
  calculateAgeTrainingCostFactor,
  MAX_SKILL_LEVEL,
  type TalentEstimate
} from "../training/index.js";
import {
  DEVELOPMENT_PRIORITY_WEIGHTS,
  DEVELOPMENT_PROFILES,
  suggestDevelopmentProfile,
  type DevelopmentProfile,
  type DevelopmentSkill,
  type PlayerDevelopmentGap,
  type PlayerDevelopmentTarget
} from "../playerDevelopment/index.js";
import { SQUAD_PLANNING_CONFIG } from "./constants.js";
import type {
  PlayerLifecycleStage,
  SquadAssessment,
  SquadContributionMetrics,
  SquadPlayerAssessment,
  SquadPlayerContext,
  SquadPlanningConfig,
  SquadRole,
  SquadRoleAssignment,
  SquadRoleReason
} from "./types.js";

export * from "./constants.js";
export * from "./types.js";

const ROLE_ORDER: readonly SquadRole[] = [
  "core",
  "developing",
  "prospect",
  "rotation",
  "depth",
  "transition"
];

export function calculatePlayerLifecycle(
  context: SquadPlayerContext,
  config: SquadPlanningConfig = SQUAD_PLANNING_CONFIG
): PlayerLifecycleStage {
  const metrics = calculateContributionMetrics(context);
  const age = context.age;
  const ageFactor = readAgeFactor(context);
  const hasLongHorizon =
    metrics.developmentPotentialScore !== null &&
    metrics.developmentPotentialScore >= config.prospectPotentialThreshold;
  const hasMaterialGap =
    metrics.developmentGap !== null && metrics.developmentGap >= config.developmentGapThreshold;
  const hasLowCurrentContribution =
    metrics.currentContributionScore === null ||
    metrics.currentContributionScore < config.usefulContributionThreshold;

  if (
    age !== null &&
    (age >= config.declineLifecycleAge || ageFactor >= config.declineLifecycleAgeFactor) &&
    (metrics.developmentPotentialScore === null ||
      metrics.developmentPotentialScore <= config.transitionDevelopmentThreshold)
  ) {
    return "decline";
  }

  if (
    age !== null &&
    (age >= config.advancedLifecycleAge || ageFactor >= config.advancedLifecycleAgeFactor) &&
    !hasMaterialGap
  ) {
    return "late_prime";
  }

  if (
    hasLongHorizon &&
    hasMaterialGap &&
    hasLowCurrentContribution &&
    (age === null || age <= config.advancedLifecycleAge)
  ) {
    return "prospect";
  }

  if (hasMaterialGap && metrics.hasActiveDevelopmentPlan) {
    return "development";
  }

  return "prime";
}

export function calculateCurrentContributionScore(context: SquadPlayerContext): number | null {
  return calculateContributionMetrics(context).currentContributionScore;
}

export function calculateFutureContributionScore(context: SquadPlayerContext): number | null {
  return calculateContributionMetrics(context).futureContributionScore;
}

export function calculateDevelopmentPotentialScore(context: SquadPlayerContext): number | null {
  return calculateContributionMetrics(context).developmentPotentialScore;
}

export function calculateSquadContributionMetrics(
  context: SquadPlayerContext
): SquadContributionMetrics {
  return calculateContributionMetrics(context);
}

export function assessSquadRole(
  context: SquadPlayerContext,
  relativeContributionPercentile?: number | null,
  config: SquadPlanningConfig = SQUAD_PLANNING_CONFIG
): SquadPlayerAssessment {
  const metrics = calculateContributionMetrics(context);
  const lifecycle = calculatePlayerLifecycle(context, config);
  const percentile = normalizePercentile(relativeContributionPercentile);
  const automaticRole = classifyAutomaticRole({
    context,
    metrics,
    lifecycle,
    percentile,
    config
  });
  const stableRole = stabilizeRole(automaticRole, context, metrics, lifecycle, config);
  const reasons = buildReasons({
    context,
    metrics,
    lifecycle,
    percentile,
    role: stableRole,
    config
  });
  const manualRole = context.manualRole?.source === "manual" ? context.manualRole : null;
  const effectiveRole = manualRole?.role ?? stableRole;

  return {
    playerId: context.playerId,
    role: effectiveRole,
    source: manualRole ? "manual" : "automatic",
    automaticRole: stableRole,
    manualRole,
    lifecycle,
    profile: metrics.profile,
    currentContributionScore: metrics.currentContributionScore,
    futureContributionScore: metrics.futureContributionScore,
    developmentPotentialScore: metrics.developmentPotentialScore,
    currentContributionPercentile: percentile,
    confidence: calculateConfidence(context, metrics, percentile, config),
    reasons
  };
}

export function assessSquad(
  contexts: readonly SquadPlayerContext[],
  config: SquadPlanningConfig = SQUAD_PLANNING_CONFIG
): SquadAssessment {
  const scoreByPlayer = contexts.map((context) => ({
    playerId: context.playerId,
    score: calculateContributionMetrics(context).currentContributionScore
  }));
  const knownScores = scoreByPlayer
    .filter((entry): entry is { playerId: number; score: number } => entry.score !== null)
    .sort((left, right) => right.score - left.score || left.playerId - right.playerId);
  const rankByPlayer = new Map(knownScores.map((entry, index) => [entry.playerId, index] as const));
  const assessments = contexts
    .map((context) => {
      const score = scoreByPlayer.find((entry) => entry.playerId === context.playerId)?.score;
      const rank = rankByPlayer.get(context.playerId);
      const percentile =
        score === undefined || rank === undefined || knownScores.length === 0
          ? null
          : knownScores.length === 1
            ? 1
            : 1 - rank / (knownScores.length - 1);
      return assessSquadRole(context, percentile, config);
    })
    .sort((left, right) => left.playerId - right.playerId);

  return {
    players: assessments,
    summary: ROLE_ORDER.reduce(
      (summary, role) => ({
        ...summary,
        [role]: assessments.filter((assessment) => assessment.role === role).length
      }),
      createEmptySummary()
    )
  };
}

export class SquadPlanner {
  constructor(private readonly config: SquadPlanningConfig = SQUAD_PLANNING_CONFIG) {}

  assessPlayer(
    context: SquadPlayerContext,
    relativeContributionPercentile?: number | null
  ): SquadPlayerAssessment {
    return assessSquadRole(context, relativeContributionPercentile, this.config);
  }

  assessSquad(contexts: readonly SquadPlayerContext[]): SquadAssessment {
    return assessSquad(contexts, this.config);
  }
}

export function applySquadRoleOverride(
  assessment: SquadPlayerAssessment,
  assignment: SquadRoleAssignment | null
): SquadPlayerAssessment {
  if (
    !assignment ||
    assignment.source !== "manual" ||
    assignment.playerId !== assessment.playerId
  ) {
    return assessment;
  }

  return {
    ...assessment,
    role: assignment.role,
    source: "manual",
    manualRole: assignment
  };
}

function calculateContributionMetrics(context: SquadPlayerContext): SquadContributionMetrics {
  const profile = resolveProfile(context);
  const target = resolveTarget(context, profile);
  const gap =
    context.developmentGap ??
    context.developmentPlan?.gap ??
    (target ? calculateGap(context, target) : null);
  const currentContributionScore = profile
    ? weightedSkillScore(context, target ?? defaultTarget(context, profile), "current")
    : null;
  const targetContributionScore = profile
    ? weightedSkillScore(context, target ?? defaultTarget(context, profile), "target")
    : null;
  const developmentPotentialScore = calculatePotential(context, gap);
  const projectionContribution = projectionScore(context, target);
  const futureContributionScore =
    currentContributionScore === null
      ? projectionContribution
      : targetContributionScore === null
        ? currentContributionScore
        : clamp(
            Math.max(currentContributionScore, projectionContribution ?? targetContributionScore),
            0,
            1
          );
  const hasActiveDevelopmentPlan =
    context.hasDevelopmentPlan ??
    Boolean(
      context.developmentPlan ||
      context.developmentTarget ||
      context.trainingPath ||
      context.projection
    );

  return {
    profile,
    currentContributionScore,
    futureContributionScore,
    developmentPotentialScore,
    developmentGap: gap?.totalGap === undefined ? null : normalizeGap(gap, target),
    targetProgress: gap?.progress ?? null,
    hasActiveDevelopmentPlan
  };
}

function resolveProfile(context: SquadPlayerContext): DevelopmentProfile | null {
  if (context.profile) return context.profile;
  if (context.developmentPlan?.target.profile) return context.developmentPlan.target.profile;
  if (context.developmentTarget?.profile) return context.developmentTarget.profile;
  if (context.developmentGap?.profile) return context.developmentGap.profile;
  if (context.projection?.profile) return context.projection.profile;
  if (!hasKnownSkill(context)) return null;
  return suggestDevelopmentProfile(context).profile;
}

function resolveTarget(
  context: SquadPlayerContext,
  profile: DevelopmentProfile | null
): PlayerDevelopmentTarget | null {
  if (context.developmentTarget) return context.developmentTarget;
  if (context.developmentPlan?.target) return context.developmentPlan.target;
  if (context.developmentGap) {
    return {
      playerId: context.playerId,
      profile: context.developmentGap.profile,
      targetSkills: context.developmentGap.skills.map((skill) => ({
        skill: skill.skill,
        targetLevel: skill.targetLevel,
        priority: skill.priority
      })),
      source: "automatic"
    };
  }
  return profile ? defaultTarget(context, profile) : null;
}

function defaultTarget(
  context: SquadPlayerContext,
  profile: DevelopmentProfile
): PlayerDevelopmentTarget {
  return {
    playerId: context.playerId,
    profile,
    targetSkills: DEVELOPMENT_PROFILES[profile].relevantSkills.map((skill) => ({
      skill: skill.skill,
      targetLevel: skill.defaultTargetLevel,
      priority: skill.priority
    })),
    source: "automatic"
  };
}

function calculateGap(
  context: SquadPlayerContext,
  target: PlayerDevelopmentTarget
): PlayerDevelopmentGap {
  const skills = target.targetSkills.map((targetSkill) => {
    const currentLevel = readSkill(context, targetSkill.skill);
    const levelsRemaining = Math.max(targetSkill.targetLevel - currentLevel, 0);
    return {
      skill: targetSkill.skill,
      currentLevel,
      targetLevel: targetSkill.targetLevel,
      levelsRemaining,
      priority: targetSkill.priority,
      completed: levelsRemaining === 0
    };
  });
  const totalWeight = skills.reduce(
    (total, skill) => total + DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority],
    0
  );
  const completedWeight = skills.reduce((total, skill) => {
    const completion =
      skill.targetLevel > 0
        ? Math.min(skill.currentLevel, skill.targetLevel) / skill.targetLevel
        : 1;
    return total + completion * DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority];
  }, 0);
  return {
    playerId: context.playerId,
    profile: target.profile,
    skills,
    totalGap: skills.reduce((total, skill) => total + skill.levelsRemaining, 0),
    progress: totalWeight === 0 ? 1 : clamp(completedWeight / totalWeight, 0, 1)
  };
}

function weightedSkillScore(
  context: SquadPlayerContext,
  target: PlayerDevelopmentTarget,
  mode: "current" | "target"
): number | null {
  let weighted = 0;
  let totalWeight = 0;
  for (const targetSkill of target.targetSkills) {
    const weight = DEVELOPMENT_PRIORITY_WEIGHTS[targetSkill.priority];
    const level =
      mode === "target" ? targetSkill.targetLevel : readSkill(context, targetSkill.skill);
    weighted += clamp(level / MAX_SKILL_LEVEL, 0, 1) * weight;
    totalWeight += weight;
  }
  return totalWeight === 0 ? null : roundScore(weighted / totalWeight);
}

function calculatePotential(
  context: SquadPlayerContext,
  gap: PlayerDevelopmentGap | null
): number | null {
  if (!gap || gap.skills.length === 0) return null;
  const targetWeight = gap.skills.reduce(
    (total, skill) => total + DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority] * skill.targetLevel,
    0
  );
  if (targetWeight <= 0) return null;
  const remainingWeight = gap.skills.reduce(
    (total, skill) => total + DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority] * skill.levelsRemaining,
    0
  );
  const remainingRatio = remainingWeight / targetWeight;
  const talentFactor = talentFactorFor(context.talent);
  const ageFactor = agePotentialFactor(context);
  return roundScore(clamp(remainingRatio * talentFactor * ageFactor, 0, 1));
}

function projectionScore(
  context: SquadPlayerContext,
  target: PlayerDevelopmentTarget | null
): number | null {
  const projection = context.projection;
  if (!projection || projection.projectionStatus === "unavailable" || !target) return null;
  const completedTarget = projection.completion.estimatedWeeks !== null;
  return completedTarget ? weightedSkillScore(context, target, "target") : null;
}

function classifyAutomaticRole(input: {
  context: SquadPlayerContext;
  metrics: SquadContributionMetrics;
  lifecycle: PlayerLifecycleStage;
  percentile: number | null;
  config: SquadPlanningConfig;
}): SquadRole {
  const { metrics, lifecycle, percentile, config } = input;
  const current = metrics.currentContributionScore ?? 0;
  const future = metrics.futureContributionScore ?? current;
  const potential = metrics.developmentPotentialScore ?? 0;
  const gap = metrics.developmentGap ?? 0;
  const isRelativeCore = percentile !== null && percentile >= 0.75;

  if (
    (lifecycle === "decline" || lifecycle === "late_prime") &&
    potential <= config.transitionDevelopmentThreshold &&
    future - current <= config.developmentGapThreshold
  ) {
    return "transition";
  }
  if (
    lifecycle === "prospect" &&
    potential >= config.prospectPotentialThreshold &&
    future >= config.highFutureContributionThreshold
  ) {
    return "prospect";
  }
  if (
    metrics.hasActiveDevelopmentPlan &&
    gap >= config.developmentGapThreshold &&
    future - current >= config.developmentGapThreshold / 1.5 &&
    current < config.coreContributionThreshold
  ) {
    return "developing";
  }
  if (current >= config.coreContributionThreshold || isRelativeCore) {
    return "core";
  }
  if (
    current >= config.usefulContributionThreshold ||
    (percentile !== null && percentile >= 0.45)
  ) {
    return "rotation";
  }
  return "depth";
}

function stabilizeRole(
  candidate: SquadRole,
  context: SquadPlayerContext,
  metrics: SquadContributionMetrics,
  lifecycle: PlayerLifecycleStage,
  config: SquadPlanningConfig
): SquadRole {
  const previous = context.previousAutomaticRole;
  if (!previous || previous === candidate) return candidate;
  const current = metrics.currentContributionScore ?? 0;
  const potential = metrics.developmentPotentialScore ?? 0;
  const near = config.roleStabilityMargin;

  if (
    previous === "core" &&
    candidate === "rotation" &&
    current >= config.coreContributionThreshold - near
  )
    return previous;
  if (
    previous === "rotation" &&
    candidate === "depth" &&
    current >= config.usefulContributionThreshold - near
  )
    return previous;
  if (
    (previous === "prospect" || previous === "developing") &&
    (candidate === "developing" || candidate === "prospect" || candidate === "depth") &&
    potential >= config.prospectPotentialThreshold - near
  )
    return previous;
  if (
    previous === "developing" &&
    candidate === "rotation" &&
    (metrics.developmentGap ?? 0) >= config.developmentGapThreshold - near
  )
    return previous;
  if (
    previous === "transition" &&
    candidate !== "transition" &&
    lifecycle !== "prime" &&
    potential <= config.transitionDevelopmentThreshold + near
  )
    return previous;
  return candidate;
}

function buildReasons(input: {
  context: SquadPlayerContext;
  metrics: SquadContributionMetrics;
  lifecycle: PlayerLifecycleStage;
  percentile: number | null;
  role: SquadRole;
  config: SquadPlanningConfig;
}): SquadRoleReason[] {
  const reasons: SquadRoleReason[] = [];
  const current = input.metrics.currentContributionScore ?? 0;
  const future = input.metrics.futureContributionScore ?? 0;
  const potential = input.metrics.developmentPotentialScore ?? 0;
  const gap = input.metrics.developmentGap ?? 0;

  if (current >= input.config.coreContributionThreshold)
    reasons.push({ type: "high_current_contribution" });
  if (current <= input.config.usefulContributionThreshold - input.config.roleStabilityMargin)
    reasons.push({ type: "low_current_contribution" });
  if (input.percentile !== null && input.percentile >= 0.75)
    reasons.push({ type: "relative_current_contribution" });
  if (potential >= input.config.prospectPotentialThreshold)
    reasons.push({ type: "high_future_potential" });
  if (input.metrics.hasActiveDevelopmentPlan && gap >= input.config.developmentGapThreshold)
    reasons.push({ type: "active_development_plan" });
  if (
    input.metrics.targetProgress !== null &&
    input.metrics.targetProgress >= 1 - input.config.roleStabilityMargin
  )
    reasons.push({ type: "target_nearly_completed" });
  if (potential <= input.config.transitionDevelopmentThreshold)
    reasons.push({ type: "limited_remaining_development" });
  if (input.lifecycle === "late_prime" || input.lifecycle === "decline")
    reasons.push({ type: "late_lifecycle_stage" });
  if (input.context.projection?.projectionStatus === "projected")
    reasons.push({ type: "strong_development_projection" });
  if (
    (input.context.training?.kind ?? input.context.trainingStatus) === "advanced" &&
    gap >= input.config.developmentGapThreshold
  )
    reasons.push({ type: "training_supports_development" });
  if (!input.metrics.hasActiveDevelopmentPlan) reasons.push({ type: "missing_development_plan" });
  if (future - current >= input.config.developmentGapThreshold)
    reasons.push({ type: "high_future_potential" });
  return uniqueReasons(reasons);
}

function calculateConfidence(
  context: SquadPlayerContext,
  metrics: SquadContributionMetrics,
  percentile: number | null,
  config: SquadPlanningConfig
): "low" | "medium" | "high" {
  let evidence = 0;
  if (metrics.hasActiveDevelopmentPlan && (context.developmentTarget || context.developmentGap))
    evidence += 1;
  if (context.projection || context.trainingPath) evidence += 1;
  if (context.talent?.value !== null && context.talent?.value !== undefined) evidence += 1;
  if ((context.talent?.confidence ?? "unknown") === "high") evidence += 1;
  if ((context.historyWeeks ?? 0) >= 3) evidence += 1;
  if (
    percentile !== null &&
    (percentile <= 0.5 - config.highClarityMargin || percentile >= 0.5 + config.highClarityMargin)
  )
    evidence += 1;
  if (metrics.currentContributionScore === null) return "low";
  if (evidence >= 5) return "high";
  if (evidence >= 2) return "medium";
  return "low";
}

function readAgeFactor(context: SquadPlayerContext): number {
  if (
    context.ageFactor !== null &&
    context.ageFactor !== undefined &&
    Number.isFinite(context.ageFactor)
  )
    return context.ageFactor;
  if (context.age === null || !Number.isFinite(context.age)) return 1;
  return calculateAgeTrainingCostFactor(Math.max(context.age, BASE_TRAINING_AGE));
}

function agePotentialFactor(context: SquadPlayerContext): number {
  const ageFactor = readAgeFactor(context);
  return clamp(1 / Math.sqrt(Math.max(ageFactor, 1)), 0.25, 1);
}

function talentFactorFor(talent: TalentEstimate | null | undefined): number {
  if (!talent?.value || !Number.isFinite(talent.value)) return 0.7;
  return clamp(talent.value / 1.2, 0.55, 1.15);
}

function readSkill(context: SquadPlayerContext, skill: DevelopmentSkill): number {
  const value = context.skills[skill];
  return typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function hasKnownSkill(context: SquadPlayerContext): boolean {
  return Object.values(context.skills).some(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
}

function normalizeGap(gap: PlayerDevelopmentGap, target: PlayerDevelopmentTarget | null): number {
  const maximum = target?.targetSkills.reduce((total, skill) => total + skill.targetLevel, 0) ?? 0;
  return maximum > 0 ? clamp(gap.totalGap / maximum, 0, 1) : 0;
}

function normalizePercentile(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value)
    ? null
    : clamp(value, 0, 1);
}

function roundScore(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(4));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function uniqueReasons(reasons: SquadRoleReason[]): SquadRoleReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    if (seen.has(reason.type)) return false;
    seen.add(reason.type);
    return true;
  });
}

function createEmptySummary(): Record<SquadRole, number> {
  return {
    core: 0,
    developing: 0,
    prospect: 0,
    rotation: 0,
    depth: 0,
    transition: 0
  };
}

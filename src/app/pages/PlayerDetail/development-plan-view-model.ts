import {
  buildPlayerDevelopmentPlan,
  generatePlayerTrainingPath,
  projectDevelopment,
  type DevelopmentProfile,
  type DevelopmentProjectionWarning,
  type DevelopmentSkill,
  type DevelopmentTrainingAssumptions,
  type PlayerDevelopmentProjection,
  type PlayerDevelopmentTargetOverride,
  type PlayerTrainingPath
} from "@atlas/application";
import {
  calculateWeeklyTrainingPointsByKind,
  type TalentEstimate as DomainTalentEstimate
} from "@atlas/domain";
import { DEVELOPMENT_PROFILES } from "@atlas/domain";
import type { TrainingPageData, TrainingPagePlayer } from "@atlas/web/app/types";
import type { PlayerDetailViewModel } from "../../view-models/player-detail-view-model";

export interface DevelopmentPlanTargetRow {
  skill: DevelopmentSkill;
  currentLevel: number;
  targetLevel: number;
  remaining: number;
  priority: "primary" | "secondary" | "supporting";
  status: "complete" | "in_progress" | "pending";
  reasons: string[];
}

export interface DevelopmentPlanPathRow {
  order: number;
  skill: DevelopmentSkill;
  fromLevel: number;
  toLevel: number;
  priority: "primary" | "secondary" | "supporting";
  estimatedWeeks: number | null;
  cumulativeWeeks: number | null;
  confidence: "low" | "medium" | "high" | null;
  isCurrent: boolean;
  reasons: string[];
}

export interface DevelopmentPlanMilestoneRow {
  type: PlayerDevelopmentProjection["milestones"][number]["type"];
  skill: DevelopmentSkill | null;
  step: number;
  cumulativeWeeks: number;
  estimatedGameWeek: number;
  estimatedDate: Date | null;
  estimatedAge: number | null;
  confidence: "low" | "medium" | "high";
  label: string;
}

export interface DevelopmentPlanViewModel {
  profile: {
    current: DevelopmentProfile;
    currentLabel: string;
    source: "automatic" | "manual";
    suggested: DevelopmentProfile;
    suggestedLabel: string;
    suggestionConfidence: "low" | "medium" | "high";
    hasConflict: boolean;
  };
  progress: {
    percentage: number;
    completedLevels: number;
    totalLevels: number;
    remainingLevels: number;
  };
  nextStep: DevelopmentPlanPathRow | null;
  completion: {
    estimatedWeeks: number | null;
    estimatedGameWeek: number | null;
    estimatedDate: Date | null;
    estimatedAge: number | null;
    confidence: "low" | "medium" | "high";
  };
  assumptions: DevelopmentTrainingAssumptions;
  warnings: Array<{ code: DevelopmentProjectionWarning; label: string }>;
  idealTargets: DevelopmentPlanTargetRow[];
  targets: DevelopmentPlanTargetRow[];
  path: DevelopmentPlanPathRow[];
  milestones: DevelopmentPlanMilestoneRow[];
  completed: boolean;
  projectionStatus: PlayerDevelopmentProjection["projectionStatus"];
  weeklyTrainingAlignment: {
    status: "aligned" | "mismatch" | "unavailable";
    plannedSkill: DevelopmentSkill | null;
    currentSkill: DevelopmentSkill | null;
  };
  editor: {
    profile: DevelopmentProfile;
    targetLevels: Partial<Record<DevelopmentSkill, number>>;
  };
}

export interface CreateDevelopmentPlanViewModelInput {
  player: PlayerDetailViewModel;
  training: TrainingPageData | null;
  manualOverride: PlayerDevelopmentTargetOverride | null;
}

export function createDevelopmentPlanViewModel(
  input: CreateDevelopmentPlanViewModelInput
): DevelopmentPlanViewModel | null {
  const developmentPlayer = input.player.developmentPlayer;

  if (!developmentPlayer) {
    return null;
  }

  const trainingPlayer = findTrainingPlayer(input.training, input.player.player.id);
  const talent = toDomainTalent(trainingPlayer?.talentEstimate ?? null);
  const latestReport = currentTrainingReport(input.training, trainingPlayer);
  const plan = buildPlayerDevelopmentPlan(developmentPlayer, input.manualOverride);
  const expectedIntensity = normalizedIntensity(latestReport?.intensity);
  const trainingKind = latestReport?.kind;
  const assumptions: DevelopmentTrainingAssumptions = {
    trainingKind: trainingKind === "formation" ? "formation" : "advanced",
    expectedIntensity,
    assumeContinuousTraining: true
  };
  const expectedWeeklyTrainingPoints = calculateWeeklyTrainingPointsByKind({
    kind: assumptions.trainingKind,
    intensity: assumptions.expectedIntensity
  });
  const path = generatePlayerTrainingPath({
    player: developmentPlayer,
    target: plan.target,
    developmentGap: plan.gap,
    talent,
    expectedWeeklyTrainingPoints
  });
  const projection = createProjection({
    player: developmentPlayer,
    target: plan.target,
    path,
    talent,
    assumptions,
    latestReport,
    training: input.training
  });

  return mapPlan({ plan, path, projection, latestReport });
}

function createProjection(input: {
  player: NonNullable<PlayerDetailViewModel["developmentPlayer"]>;
  target: ReturnType<typeof buildPlayerDevelopmentPlan>["target"];
  path: PlayerTrainingPath;
  talent: DomainTalentEstimate | null;
  assumptions: DevelopmentTrainingAssumptions;
  latestReport: NonNullable<TrainingPagePlayer["latestReport"]> | null;
  training: TrainingPageData | null;
}): PlayerDevelopmentProjection {
  const currentGameWeek = input.latestReport?.gameWeek ?? 1;
  const currentDate =
    validDate(input.latestReport?.date ?? input.training?.snapshotDate) ?? new Date();

  return projectDevelopment({
    player: input.player,
    target: input.target,
    path: input.path,
    currentGameWeek,
    currentDate,
    talent: input.talent,
    trainingAssumptions: input.assumptions
  });
}

function mapPlan(input: {
  plan: ReturnType<typeof buildPlayerDevelopmentPlan>;
  path: PlayerTrainingPath;
  projection: PlayerDevelopmentProjection;
  latestReport: NonNullable<TrainingPagePlayer["latestReport"]> | null;
}): DevelopmentPlanViewModel {
  const projectionByOrder = new Map(input.projection.steps.map((step) => [step.order, step]));
  const idealTargets = input.plan.idealTarget.targetSkills.map((skill) => ({
    skill: skill.skill,
    currentLevel: input.plan.gap.skills.find(s => s.skill === skill.skill)?.currentLevel ?? 0,
    targetLevel: skill.targetLevel,
    remaining: Math.max(0, skill.targetLevel - (input.plan.gap.skills.find(s => s.skill === skill.skill)?.currentLevel ?? 0)),
    priority: skill.priority,
    status: (input.plan.gap.skills.find(s => s.skill === skill.skill)?.currentLevel ?? 0) >= skill.targetLevel
      ? ("complete" as const)
      : (input.plan.gap.skills.find(s => s.skill === skill.skill)?.currentLevel ?? 0) > 0
        ? ("in_progress" as const)
        : ("pending" as const),
    reasons: skill.reasons?.map(targetReasonLabel) ?? []
  }));
  const targets = input.plan.gap.skills.map((skill) => {
    const targetSkill = input.plan.target.targetSkills.find(s => s.skill === skill.skill);
    return {
      skill: skill.skill,
      currentLevel: skill.currentLevel,
      targetLevel: skill.targetLevel,
      remaining: skill.levelsRemaining,
      priority: skill.priority,
      status: skill.completed
        ? ("complete" as const)
        : skill.currentLevel > 0
          ? ("in_progress" as const)
          : ("pending" as const),
      reasons: targetSkill?.reasons?.map(targetReasonLabel) ?? []
    };
  });
  const path = input.path.steps.map((step) => {
    const projectionStep = projectionByOrder.get(step.order);

    return {
      order: step.order,
      skill: step.skill,
      fromLevel: step.fromLevel,
      toLevel: step.toLevel,
      priority: step.priority,
      estimatedWeeks: projectionStep?.estimatedWeeks ?? null,
      cumulativeWeeks: projectionStep?.cumulativeWeeks ?? null,
      confidence: projectionStep?.confidence ?? null,
      isCurrent: step.order === 1,
      reasons: step.reason.map(reasonLabel)
    };
  });
  const completedLevels = targets.reduce(
    (total, target) => total + Math.min(target.currentLevel, target.targetLevel),
    0
  );
  const totalLevels = targets.reduce((total, target) => total + target.targetLevel, 0);
  const milestones = input.projection.milestones.map((milestone) => ({
    type: milestone.type,
    skill: milestone.skill ?? null,
    step: milestone.step,
    cumulativeWeeks: milestone.cumulativeWeeks,
    estimatedGameWeek: milestone.estimatedGameWeek,
    estimatedDate: milestone.estimatedDate,
    estimatedAge: milestone.estimatedAge,
    confidence: milestone.confidence,
    label: milestoneLabel(milestone.type, milestone.skill)
  }));
  const plannedSkill = path[0]?.skill ?? null;
  const currentSkill = developmentSkillForTrainingType(input.latestReport?.type);

  return {
    profile: {
      current: input.plan.target.profile,
      currentLabel: profileLabel(input.plan.target.profile),
      source: input.plan.target.source,
      suggested: input.plan.suggestion.profile,
      suggestedLabel: profileLabel(input.plan.suggestion.profile),
      suggestionConfidence: input.plan.suggestion.confidence,
      hasConflict: input.plan.target.profile !== input.plan.suggestion.profile
    },
    progress: {
      percentage: input.plan.gap.progress * 100,
      completedLevels,
      totalLevels,
      remainingLevels: input.plan.gap.totalGap
    },
    nextStep: path[0] ?? null,
    completion: {
      ...input.projection.completion,
      confidence: input.projection.confidence
    },
    assumptions: input.projection.assumptions,
    warnings: input.projection.warnings.map((code) => ({ code, label: warningLabel(code) })),
    idealTargets,
    targets,
    path,
    milestones,
    completed: input.path.completed,
    projectionStatus: input.projection.projectionStatus,
    weeklyTrainingAlignment: {
      status:
        plannedSkill === null || currentSkill === null
          ? "unavailable"
          : plannedSkill === currentSkill
            ? "aligned"
            : "mismatch",
      plannedSkill,
      currentSkill
    },
    editor: {
      profile: input.plan.target.profile,
      targetLevels: Object.fromEntries(
        input.plan.target.targetSkills.map((skill) => [skill.skill, skill.targetLevel])
      )
    }
  };
}

export function developmentProfileOptions(): DevelopmentProfile[] {
  return Object.keys(DEVELOPMENT_PROFILES) as DevelopmentProfile[];
}

export function targetDefaultsForProfile(
  profile: DevelopmentProfile,
  currentLevels: Partial<Record<DevelopmentSkill, number>>
): Partial<Record<DevelopmentSkill, number>> {
  return Object.fromEntries(
    DEVELOPMENT_PROFILES[profile].relevantSkills.map((skill) => [
      skill.skill,
      Math.max(currentLevels[skill.skill] ?? 0, skill.defaultTargetLevel)
    ])
  );
}

function findTrainingPlayer(
  training: TrainingPageData | null,
  playerId: string
): TrainingPagePlayer | null {
  return training?.players.find((player) => String(player.playerId) === playerId) ?? null;
}

function currentTrainingReport(
  training: TrainingPageData | null,
  player: TrainingPagePlayer | null
): NonNullable<TrainingPagePlayer["latestReport"]> | null {
  if (player?.latestReport) {
    return player.latestReport;
  }

  return (
    training?.history
      ?.filter((report) => report.playerId === Number(player?.id))
      .sort((left, right) => right.gameWeek - left.gameWeek)[0] ?? null
  );
}

function toDomainTalent(
  talent: TrainingPagePlayer["talentEstimate"] | null
): DomainTalentEstimate | null {
  if (!talent) return null;

  return {
    value: talent.value,
    confidence: talent.confidence,
    evidenceCount: talent.evidenceCount,
    evidences: []
  };
}

function normalizedIntensity(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 100;
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function profileLabel(profile: DevelopmentProfile): string {
  return profile.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function skillLabel(skill: DevelopmentSkill | null | undefined): string {
  if (!skill) return "Unknown skill";
  const labels: Record<DevelopmentSkill, string> = {
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

function reasonLabel(reason: PlayerTrainingPath["steps"][number]["reason"][number]): string {
  switch (reason.type) {
    case "primary_target_skill":
      return `${skillLabel(reason.skill)} is a primary target skill`;
    case "high_development_return":
      return "High current development return";
    case "low_marginal_cost":
      return "Low marginal training cost";
    case "balances_profile":
      return `Balances ${skillLabel(reason.skill)} in the profile`;
    case "completes_target_skill":
      return `Completes the ${skillLabel(reason.skill)} target`;
  }
}

function targetReasonLabel(reason: import("@atlas/domain").DevelopmentTargetReason): string {
  switch (reason.type) {
    case "primary_skill":
      return "Primary profile skill";
    case "within_development_horizon":
      return `Positive development potential at age ${reason.age.toFixed(1)}`;
    case "positive_marginal_return":
      return `Positive marginal return (score: ${reason.score.toFixed(1)})`;
    case "manual_override":
      return "Manually configured target";
    default:
      return "Target skill";
  }
}

function milestoneLabel(
  type: PlayerDevelopmentProjection["milestones"][number]["type"],
  skill: DevelopmentSkill | undefined
): string {
  if (type === "skill_target_completed") return `${skillLabel(skill)} target complete`;
  if (type === "primary_skills_completed") return "Primary skills complete";
  return "Development target complete";
}

function warningLabel(code: DevelopmentProjectionWarning): string {
  const labels: Record<DevelopmentProjectionWarning, string> = {
    unknown_current_sublevel:
      "Current sublevel is unknown; first step uses a conservative estimate.",
    low_talent_confidence: "Talent estimate has low confidence.",
    long_term_projection: "Long-term estimate — confidence decreases over time.",
    formation_training_assumed: "Formation training assumed.",
    advanced_training_assumed: "Advanced training assumed.",
    intensity_assumed: "Expected intensity is an assumption.",
    projection_horizon_exceeded: "Timeline available only within the projection horizon.",
    invalid_training_points: "Training model could not calculate valid points.",
    path_incomplete: "The generated path does not complete the target.",
    continuous_training_not_assumed: "Continuous training is not assumed."
  };
  return labels[code];
}

function developmentSkillForTrainingType(type: string | undefined): DevelopmentSkill | null {
  const skills: Record<string, DevelopmentSkill> = {
    stamina: "stamina",
    pace: "pace",
    technique: "technique",
    passing: "passing",
    keeper: "keeper",
    defending: "defender",
    playmaking: "playmaker",
    striker: "striker",
    scoring: "striker"
  };
  return type ? (skills[type] ?? null) : null;
}

import {
  calculateProjectedWeeklyTrainingPoints,
  generatePlayerTrainingPath,
  projectDevelopment
} from "../playerDevelopment/index.js";
import type {
  DevelopmentProfile,
  DevelopmentPriority,
  DevelopmentSkill,
  PlayerDevelopmentTarget,
  Formation
} from "../playerDevelopment/index.js";
import { assessSquadRole, SQUAD_PLANNING_CONFIG } from "../squadPlanning/index.js";
import {
  getSokkerSeason,
  normalizeSeasonWeek,
  WEEKS_PER_SOKKER_SEASON
} from "../sokker/calendar.js";
import { DEFAULT_TALENT_FOR_RELATIVE_COMPARISON } from "../training/constants.js";
import { buildAcquisitionTargetGaps } from "./acquisition-targets.js";

export type AcquisitionTalentScenario = "high" | "normal" | "low";

export const ACQUISITION_TALENT_FACTORS: Readonly<Record<AcquisitionTalentScenario, number>> = {
  high: DEFAULT_TALENT_FOR_RELATIVE_COMPARISON * 0.8,
  normal: DEFAULT_TALENT_FOR_RELATIVE_COMPARISON,
  low: DEFAULT_TALENT_FOR_RELATIVE_COMPARISON * 1.2
};

export interface AcquisitionSkillStep {
  skill: DevelopmentSkill;
  level: number;
  week: number;
  residualChanges: Array<{ skill: DevelopmentSkill; level: number; week: number }>;
}

export function projectAcquisitionSkills(
  initialSkills: Record<string, number>,
  steps: readonly AcquisitionSkillStep[],
  weeks: number
): Record<string, number> {
  const skills = { ...initialSkills };
  for (const step of steps) {
    for (const change of step.residualChanges) {
      if (change.week <= weeks) skills[change.skill] = change.level;
    }
    if (step.week <= weeks) skills[step.skill] = step.level;
  }
  return skills;
}

export interface AcquisitionDevelopmentPlan {
  gaps: Array<{
    skill: DevelopmentSkill;
    current: number;
    target: number;
    priority: DevelopmentPriority;
  }>;
  currentRole: string;
  coreWeek: number | null;
  coreAge: number | null;
  steps: Array<AcquisitionSkillStep & {
    age: number | null;
    season: number | null;
    seasonWeek: number | null;
  }>;
  currentTrainingSteps: AcquisitionSkillStep[];
  assumptions: string;
}

export function buildAcquisitionDevelopmentPlan(input: {
  playerId: number;
  age: number | null;
  profile: DevelopmentProfile | null;
  skills: Record<string, number>;
  trainingSkill: string | null;
  hasAdvancedSlot: boolean;
  talentScenario?: AcquisitionTalentScenario;
  currentGameWeek?: number | null;
  targetLevels?: Partial<Record<DevelopmentSkill, number>>;
}): AcquisitionDevelopmentPlan | null {
  if (input.age === null || input.profile === null) return null;
  const profile = input.profile;
  const gaps = buildAcquisitionTargetGaps(profile, input.skills, input.targetLevels);
  if (!gaps) return null;
  const player = { playerId: input.playerId, age: input.age, skills: input.skills, profile };
  const target: PlayerDevelopmentTarget = {
    playerId: input.playerId,
    profile,
    source:
      input.targetLevels && Object.keys(input.targetLevels).length > 0 ? "manual" : "automatic",
    objective: "sportive",
    targetSkills: gaps
      .filter((gap) => gap.skill !== "stamina")
      .map((gap) => ({
        skill: gap.skill,
        targetLevel: Math.max(gap.current, gap.target),
        priority: gap.priority
      }))
  };
  const talentScenario = input.talentScenario ?? "normal";
  const talent = {
    value: ACQUISITION_TALENT_FACTORS[talentScenario],
    confidence: "low" as const,
    evidenceCount: 0,
    evidences: []
  };
  let currentSeason: number | null = null;
  let currentSeasonWeek: number | null = null;
  if (input.currentGameWeek != null) {
    try {
      currentSeason = getSokkerSeason(input.currentGameWeek);
      currentSeasonWeek = normalizeSeasonWeek(input.currentGameWeek);
    } catch {
      // A snapshot outside the supported calendar has no reliable season anchor.
    }
  }
  const formations: Record<DevelopmentProfile, Formation> = {
    goalkeeper: "GK", defender: "DEF", midfielder: "MID", forward: "ATT"
  };
  const trainingKind = input.hasAdvancedSlot ? "advanced" : "formation";
  // Talent changes the required points; the weekly rate uses the neutral calibration.
  const referenceWeeklyPoints = calculateProjectedWeeklyTrainingPoints({
    talent: DEFAULT_TALENT_FOR_RELATIVE_COMPARISON, intensity: 100, trainingKind: "advanced"
  });
  const expectedWeeklyTrainingPoints = calculateProjectedWeeklyTrainingPoints({
    talent: DEFAULT_TALENT_FOR_RELATIVE_COMPARISON, intensity: 100, trainingKind
  });
  const trainingPlayer = {
    formation: formations[profile],
    ...player,
    age:
      input.age +
      (currentSeasonWeek === null ? 0 : (currentSeasonWeek - 1) / WEEKS_PER_SOKKER_SEASON)
  };
  const makeProjection = (selectedTarget: PlayerDevelopmentTarget) => {
    const path = generatePlayerTrainingPath({
      player: trainingPlayer,
      target: selectedTarget,
      talent,
      expectedWeeklyTrainingPoints,
      residualTraining: { referenceWeeklyPoints, progress: {} }
    });
    return projectDevelopment({
      player: trainingPlayer,
      target: selectedTarget,
      path,
      talent,
      currentGameWeek: 1,
      currentDate: new Date(0),
      expectedWeeklyTrainingPoints,
      trainingAssumptions: {
        trainingKind,
        expectedIntensity: 100,
        assumeContinuousTraining: true
      }
    });
  };
  const projection = makeProjection(target);
  const skillState = { ...input.skills };
  const currentRole = assessSquadRole(player).role;
  const projectedRole = (age: number) =>
    assessSquadRole({
      ...player,
      age,
      skills: {
        ...skillState,
        stamina: Math.max(skillState.stamina ?? 0, SQUAD_PLANNING_CONFIG.coreStaminaMinimum)
      }
    }).role;
  const isProjectedCoreNow = projectedRole(input.age) === "core";
  let coreWeek: number | null = isProjectedCoreNow ? 0 : null;
  let coreAge: number | null = isProjectedCoreNow ? input.age : null;
  const ageAtWeek = (week: number) =>
    currentSeason !== null && input.currentGameWeek != null
      ? input.age! + getSokkerSeason(input.currentGameWeek + week) - currentSeason
      : input.age! + Math.floor(week / WEEKS_PER_SOKKER_SEASON);
  const steps = projection.steps.flatMap((step) => {
    if (step.cumulativeWeeks === null) return [];
    const residualChanges = (step.residualChanges ?? []).map((change) => ({
      skill: change.skill,
      level: change.toLevel,
      week: step.cumulativeWeeks! - (step.estimatedWeeks ?? 0) + change.weekOffset
    }));
    for (const change of residualChanges) {
      skillState[change.skill] = change.level;
      const changeAge = ageAtWeek(change.week);
      if (coreWeek === null && projectedRole(changeAge) === "core") {
        coreWeek = change.week;
        coreAge = changeAge;
      }
    }
    skillState[step.skill] = step.toLevel;
    let age = input.age! + Math.floor(step.cumulativeWeeks / WEEKS_PER_SOKKER_SEASON);
    let season: number | null = null;
    let seasonWeek: number | null = null;
    if (input.currentGameWeek != null && currentSeason !== null) {
      try {
        const gameWeek = input.currentGameWeek + step.cumulativeWeeks;
        season = getSokkerSeason(gameWeek);
        seasonWeek = normalizeSeasonWeek(gameWeek);
        age = input.age! + season - currentSeason;
      } catch {
        // Older or invalid snapshots cannot be mapped to the supported calendar.
      }
    }
    if (coreWeek === null && projectedRole(age) === "core") {
      coreWeek = step.cumulativeWeeks;
      coreAge = age;
    }
    return [
      {
        skill: step.skill,
        residualChanges,
        level: step.toLevel,
        week: step.cumulativeWeeks,
        age,
        season,
        seasonWeek
      }
    ];
  });
  const currentTarget = target.targetSkills.find((item) => item.skill === input.trainingSkill);
  const currentProjection = currentTarget
    ? makeProjection({ ...target, targetSkills: [{ ...currentTarget, targetLevel: 18 }] })
    : null;
  return {
    gaps,
    currentRole,
    coreWeek,
    coreAge,
    steps,
    currentTrainingSteps:
      currentProjection?.steps.flatMap((step) =>
        step.cumulativeWeeks === null
          ? []
          : [{
              skill: step.skill, level: step.toLevel, week: step.cumulativeWeeks,
              residualChanges: (step.residualChanges ?? []).map((change) => ({
                skill: change.skill, level: change.toLevel,
                week: step.cumulativeWeeks! - (step.estimatedWeeks ?? 0) + change.weekOffset
              }))
            }]
      ) ?? [],
    assumptions: `Estimates assume ${talentScenario} talent as a hypothetical scenario, continuous training at full effectiveness and no initial sublevel progress. General training increases other skills, including stamina. The Core projection assumes stamina meets its requirement even if projected growth falls short. Stamina is not a dedicated training step. The proposed plan requires changes of focus; a free advanced slot must be assigned. Core status is not a guarantee of selection.`
  };
}

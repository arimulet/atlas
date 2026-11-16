import {
  DEVELOPMENT_PROFILES,
  generatePlayerTrainingPath,
  projectDevelopment
} from "../playerDevelopment/index.js";
import type {
  DevelopmentProfile,
  DevelopmentPriority,
  DevelopmentSkill,
  PlayerDevelopmentTarget
} from "../playerDevelopment/index.js";
import { assessSquadRole, SQUAD_PLANNING_CONFIG } from "../squadPlanning/index.js";
import {
  getSokkerSeason,
  normalizeSeasonWeek,
  WEEKS_PER_SOKKER_SEASON
} from "../sokker/calendar.js";
import { DEFAULT_TALENT_FOR_RELATIVE_COMPARISON } from "../training/constants.js";

export type AcquisitionTalentScenario = "high" | "normal" | "low";

export const ACQUISITION_TALENT_FACTORS: Readonly<Record<AcquisitionTalentScenario, number>> = {
  high: DEFAULT_TALENT_FOR_RELATIVE_COMPARISON * 0.8,
  normal: DEFAULT_TALENT_FOR_RELATIVE_COMPARISON,
  low: DEFAULT_TALENT_FOR_RELATIVE_COMPARISON * 1.2
};

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
  steps: Array<{
    skill: DevelopmentSkill;
    level: number;
    week: number;
    age: number | null;
    season: number | null;
    seasonWeek: number | null;
  }>;
  currentTrainingSteps: Array<{ skill: DevelopmentSkill; level: number; week: number }>;
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
  const relevant = DEVELOPMENT_PROFILES[profile].relevantSkills;
  const requiredSkills: DevelopmentSkill[] = [
    ...new Set([...relevant.map((item) => item.skill), "stamina" as const])
  ];
  if (
    requiredSkills.some((skill) => {
      const value = input.skills[skill];
      return value === undefined || !Number.isInteger(value) || value < 0 || value > 18;
    })
  )
    return null;
  const player = { playerId: input.playerId, age: input.age, skills: input.skills, profile };
  const gaps = relevant.map((item) => ({
    skill: item.skill,
    priority: item.priority,
    current: input.skills[item.skill] ?? 0,
    target:
      input.targetLevels?.[item.skill] !== undefined
        ? Math.max(input.skills[item.skill] ?? 0, input.targetLevels[item.skill]!)
        : item.priority === "primary"
          ? SQUAD_PLANNING_CONFIG.corePrimarySkillMinimum
          : item.defaultTargetLevel
  }));
  gaps.push({
    skill: "stamina",
    priority: "supporting",
    current: input.skills.stamina ?? 0,
    target: SQUAD_PLANNING_CONFIG.coreStaminaMinimum
  });
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
  const makeProjection = (selectedTarget: PlayerDevelopmentTarget) => {
    const path = generatePlayerTrainingPath({ player, target: selectedTarget, talent });
    return projectDevelopment({
      player,
      target: selectedTarget,
      path,
      talent,
      currentGameWeek: 1,
      currentDate: new Date(0),
      trainingAssumptions: {
        trainingKind: input.hasAdvancedSlot ? "advanced" : "formation",
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
  const steps = projection.steps.flatMap((step) => {
    if (step.cumulativeWeeks === null) return [];
    skillState[step.skill] = step.toLevel;
    const age = input.age! + Math.floor(step.cumulativeWeeks / WEEKS_PER_SOKKER_SEASON);
    if (coreWeek === null && projectedRole(age) === "core") {
      coreWeek = step.cumulativeWeeks;
      coreAge = age;
    }
    let season: number | null = null;
    let seasonWeek: number | null = null;
    if (input.currentGameWeek != null) {
      try {
        const gameWeek = input.currentGameWeek + step.cumulativeWeeks;
        season = getSokkerSeason(gameWeek);
        seasonWeek = normalizeSeasonWeek(gameWeek);
      } catch {
        // Older or invalid snapshots cannot be mapped to the supported calendar.
      }
    }
    return [
      {
        skill: step.skill,
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
          : [{ skill: step.skill, level: step.toLevel, week: step.cumulativeWeeks }]
      ) ?? [],
    assumptions: `Estimates assume ${talentScenario} talent as a hypothetical scenario, continuous training at full effectiveness and no initial sublevel progress. The Core projection assumes stamina reaches the required level through regular training; its actual growth is not estimated. Stamina is not a dedicated training step. The proposed plan requires changes of focus; a free advanced slot must be assigned. Core status is not a guarantee of selection.`
  };
}

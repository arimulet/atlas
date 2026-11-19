import { DEVELOPMENT_PROFILES } from "../playerDevelopment/profiles.js";
import type { DevelopmentPriority, DevelopmentProfile, DevelopmentSkill } from "../playerDevelopment/types.js";
import { SQUAD_PLANNING_CONFIG } from "../squadPlanning/constants.js";

export type AcquisitionPosition = "GK" | "DEF" | "MID" | "ATT";
export const ACQUISITION_POSITION_PROFILES: Readonly<Record<AcquisitionPosition, DevelopmentProfile>> = {
  GK: "goalkeeper", DEF: "defender", MID: "midfielder", ATT: "forward"
};

export interface AcquisitionTargetGap {
  skill: DevelopmentSkill;
  current: number;
  target: number;
  priority: DevelopmentPriority;
}

export function buildAcquisitionTargetGaps(
  profile: DevelopmentProfile,
  skills: Record<string, number>,
  targetLevels?: Partial<Record<DevelopmentSkill, number>>
): AcquisitionTargetGap[] | null {
  const relevant = DEVELOPMENT_PROFILES[profile].relevantSkills;
  if ([...relevant.map((item) => item.skill), "stamina"].some((skill) => {
    const value = skills[skill];
    return value === undefined || !Number.isInteger(value) || value < 0 || value > 18;
  })) return null;
  return [
    ...relevant.map((item) => ({
      skill: item.skill,
      priority: item.priority,
      current: skills[item.skill]!,
      target: targetLevels?.[item.skill] !== undefined
        ? Math.max(skills[item.skill]!, targetLevels[item.skill]!)
        : item.priority === "primary" ? SQUAD_PLANNING_CONFIG.corePrimarySkillMinimum : item.defaultTargetLevel
    })),
    { skill: "stamina", priority: "supporting", current: skills.stamina!, target: SQUAD_PLANNING_CONFIG.coreStaminaMinimum }
  ];
}

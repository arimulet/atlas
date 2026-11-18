import type { TrainingHistory, TrainingWeek, SkillTrainingCostSkill } from "../training/types.js";
import type { DevelopmentSkill } from "./types.js";
import type { PlayerSkill } from "../training/types.js";

/** Provisional estimates based on Sokker Asistente, not official Sokker rates. */
export const RESIDUAL_TRAINING_FACTOR = 0.15;
export const RESIDUAL_STAMINA_FACTOR = 0.05;

export const RESIDUAL_TRAINING_SKILLS: readonly DevelopmentSkill[] = [
  "stamina", "pace", "technique", "passing", "keeper", "defender", "playmaker", "striker"
];

const TRAINING_SKILL: Readonly<Record<DevelopmentSkill, SkillTrainingCostSkill>> = {
  stamina: "stamina", pace: "pace", technique: "technique", passing: "passing",
  keeper: "keeper", defender: "defending", playmaker: "playmaking", striker: "scoring"
};
const OBSERVED_SKILL: Readonly<Record<DevelopmentSkill, PlayerSkill>> = {
  stamina: "stamina", pace: "pace", technique: "technique", passing: "passing",
  keeper: "keeper", defender: "defending", playmaker: "playmaking", striker: "striker"
};

export interface HistoricalSkillProgress {
  accumulatedPoints: number;
  hasKnownBaseline: boolean;
  hasHistoryGaps: boolean;
}

/** Estimates points since the most recent observed change; unknown sublevels start at zero. */
export function estimateHistoricalSkillProgress(input: {
  history: TrainingHistory | null;
  currentGameWeek: number;
  allowKeeperResidual: boolean;
  weeklyDirectPoints: (week: TrainingWeek) => number;
  weeklyReferencePoints: (week: TrainingWeek) => number;
}): Partial<Record<DevelopmentSkill, HistoricalSkillProgress>> {
  const weeks = [...(input.history?.weeks ?? [])]
    .filter((week) => week.week <= input.currentGameWeek && week.kind !== "missing" && week.intensity > 0)
    .sort((left, right) => left.week - right.week);
  if (weeks.length === 0) return {};

  return Object.fromEntries(RESIDUAL_TRAINING_SKILLS.map((skill) => {
    const lastChangeIndex = weeks.reduce(
      (last, week, index) =>
        week.skillChanges.some((change) => change.skill === OBSERVED_SKILL[skill]) ? index : last,
      -1
    );
    const relevantWeeks = weeks.slice(lastChangeIndex + 1);
    const hasHistoryGaps = relevantWeeks.some((week, index) => {
      const previousWeek = index > 0 ? relevantWeeks[index - 1] : weeks[lastChangeIndex];
      return previousWeek !== undefined && week.week !== previousWeek.week + 1;
    });
    const accumulatedPoints = relevantWeeks.reduce((total, week) => {
      const trainedSkill = week.type === "general" ? null : week.type === "striker" ? "scoring" : week.type;
      const points = trainedSkill === TRAINING_SKILL[skill]
        ? input.weeklyDirectPoints(week)
        : skill === "keeper" && !input.allowKeeperResidual
          ? 0
        : input.weeklyReferencePoints(week) * (skill === "stamina" ? RESIDUAL_STAMINA_FACTOR : RESIDUAL_TRAINING_FACTOR);
      return total + (Number.isFinite(points) && points > 0 ? points : 0);
    }, 0);
    return [skill, { accumulatedPoints, hasKnownBaseline: lastChangeIndex >= 0, hasHistoryGaps }];
  }));
}

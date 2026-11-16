import { WEEKS_PER_SOKKER_SEASON } from "../sokker/calendar.js";

export const DEFAULT_DEVELOPMENT_TRAJECTORY_MAX_SEASONS = 14;
export const DEFAULT_DEVELOPMENT_TRAJECTORY_MAX_AGE = 30;
export const DEFAULT_DEVELOPMENT_TRAJECTORY_MAX_WEEKS =
  DEFAULT_DEVELOPMENT_TRAJECTORY_MAX_SEASONS * WEEKS_PER_SOKKER_SEASON;

export function resolveDevelopmentTrajectoryHorizonWeeks(age: number): number {
  const normalizedAge = Number.isFinite(age) ? Math.max(age, 0) : 0;
  const remainingWeeksUntilMaximumAge = Math.max(
    0,
    (DEFAULT_DEVELOPMENT_TRAJECTORY_MAX_AGE - normalizedAge) * WEEKS_PER_SOKKER_SEASON
  );

  return Math.min(DEFAULT_DEVELOPMENT_TRAJECTORY_MAX_WEEKS, remainingWeeksUntilMaximumAge);
}

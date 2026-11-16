import { normalizeSeasonWeek, WEEKS_PER_SOKKER_SEASON } from "@atlas/domain";

export function getMilestoneSeasonWeek(
  seasonWeek: number | null | undefined,
  elapsedWeeks: number,
  currentGameWeek: number | null | undefined
): number | null {
  if (Number.isInteger(seasonWeek) && seasonWeek! >= 1 && seasonWeek! <= WEEKS_PER_SOKKER_SEASON) {
    return seasonWeek!;
  }
  if (currentGameWeek == null || !Number.isInteger(elapsedWeeks) || elapsedWeeks < 0) return null;
  try {
    return normalizeSeasonWeek(currentGameWeek + elapsedWeeks);
  } catch {
    return null;
  }
}

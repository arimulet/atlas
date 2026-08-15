const SEASON_61_BASE_GAME_WEEK = 977;
const WEEKS_PER_SEASON = 13;

export function normalizeSeasonWeek(gameWeek: number): number {
  if (Number.isInteger(gameWeek) === false || gameWeek < SEASON_61_BASE_GAME_WEEK) {
    throw new Error(
      "Unsupported Sokker game week " +
        gameWeek +
        "; expected an integer at or after " +
        SEASON_61_BASE_GAME_WEEK +
        "."
    );
  }

  return ((gameWeek - SEASON_61_BASE_GAME_WEEK) % WEEKS_PER_SEASON) + 1;
}

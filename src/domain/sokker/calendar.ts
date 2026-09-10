const SEASON_61_BASE_GAME_WEEK = 977;
export const WEEKS_PER_SOKKER_SEASON = 13;

export function calculateGameWeek(season: number, seasonWeek: number): number {
  if (
    Number.isInteger(season) === false ||
    Number.isInteger(seasonWeek) === false ||
    seasonWeek < 1 ||
    seasonWeek > WEEKS_PER_SOKKER_SEASON
  ) {
    throw new Error(`Unsupported Sokker season/week ${season}/${seasonWeek}.`);
  }

  return SEASON_61_BASE_GAME_WEEK + (season - 61) * WEEKS_PER_SOKKER_SEASON + seasonWeek - 1;
}

export function getSokkerSeason(gameWeek: number): number {
  if (Number.isInteger(gameWeek) === false || gameWeek < SEASON_61_BASE_GAME_WEEK) {
    throw new Error("Unsupported Sokker game week " + gameWeek);
  }

  return 61 + Math.floor((gameWeek - SEASON_61_BASE_GAME_WEEK) / WEEKS_PER_SOKKER_SEASON);
}

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

  return ((gameWeek - SEASON_61_BASE_GAME_WEEK) % WEEKS_PER_SOKKER_SEASON) + 1;
}

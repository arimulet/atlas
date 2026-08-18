import type {
  SokkerCountryDto,
  SokkerCurrentDto,
  SokkerImportResultDto,
  SokkerJuniorDto,
  PlayerTrainingWeekDto,
  SokkerPlayerDto,
  SokkerTeamDto
} from "../types.js";

/**
 * Read-only source boundary consumed by the Sokker importer.
 *
 * Transport and external API details do not cross this interface. The
 * application layer depends on this contract rather than on Sokker's API.
 */
export interface SokkerDataProvider {
  getFullTeamData(): Promise<SokkerImportResultDto>;
  getCurrent(): Promise<SokkerCurrentDto>;
  getTeam(teamId: number): Promise<SokkerTeamDto>;
  getPlayers(teamId: number): Promise<SokkerPlayerDto[]>;
  getJuniors(teamId: number): Promise<SokkerJuniorDto[]>;
  getCountries(): Promise<SokkerCountryDto[]>;
  getCurrentTraining(): Promise<PlayerTrainingWeekDto[]>;
  getTrainingSummary(week?: number): Promise<PlayerTrainingWeekDto[]>;
  getPlayerTrainingReport(playerId: number): Promise<PlayerTrainingWeekDto[]>;
}

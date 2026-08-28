import type {
  CurrentClubContextDto,
  JuniorDto,
  TrainerDto,
  TrainingDataDto,
  TrainingSummaryDto
} from "../types.js";

/**
 * Read-only source boundary consumed by the Sokker importer.
 *
 * Transport and external API details do not cross this interface. The
 * application layer depends on this contract rather than on Sokker's API.
 */
import type { JuniorMatchDto } from "../types.js";

export interface SokkerDataProvider {
  getCurrent(): Promise<CurrentClubContextDto>;
  getTraining(): Promise<TrainingDataDto>;
  getTrainers(): Promise<TrainerDto[]>;
  getJuniors(): Promise<JuniorDto[]>;
  getTrainingSummary(): Promise<TrainingSummaryDto>;
  getJuniorMatches(season: number): Promise<Omit<JuniorMatchDto, "playerStats">[]>;
  getMatchXml(matchId: number): Promise<string>;
  getMatchLineup(matchId: number): Promise<{ homePlayers: any[], awayPlayers: any[] }>;
}

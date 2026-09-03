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
import type {
  JuniorMatchDto,
  ActiveTransferDto,
  FinalTransferDto
} from "../types.js";

export interface SokkerDataProvider {
  getCurrent(): Promise<CurrentClubContextDto>;
  getTraining(): Promise<TrainingDataDto>;
  getTrainers(): Promise<TrainerDto[]>;
  getJuniors(): Promise<JuniorDto[]>;
  getJuniorsXml(): Promise<Array<{ id: number; formation: number | null }>>;
  getTrainingSummary(): Promise<TrainingSummaryDto>;
  getJuniorMatches(season: number): Promise<Omit<JuniorMatchDto, "playerStats">[]>;
  getMatchXml(matchId: number): Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMatchLineup(matchId: number): Promise<{ homePlayers: any[], awayPlayers: any[] }>;
  getTransfers(limit: number, offset: number): Promise<ActiveTransferDto[]>;
  getTransferHistory(limit: number, offset: number): Promise<FinalTransferDto[]>;
  getPlayerTransferHistory(playerId: number): Promise<FinalTransferDto[]>;
}

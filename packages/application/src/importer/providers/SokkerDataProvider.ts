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
export interface SokkerDataProvider {
  getCurrent(): Promise<CurrentClubContextDto>;
  getTraining(): Promise<TrainingDataDto>;
  getTrainers(): Promise<TrainerDto[]>;
  getJuniors(): Promise<JuniorDto[]>;
  getTrainingSummary(): Promise<TrainingSummaryDto>;
}

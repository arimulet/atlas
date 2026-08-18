import type {
  SokkerCurrentApiDto,
  SokkerJuniorsApiDto,
  SokkerTrainersApiDto,
  SokkerTrainingApiDto,
  SokkerTrainingSummaryApiDto
} from "./api/dtos.js";

/**
 * Read-only source boundary consumed by the Sokker importer.
 *
 * Transport and external API details do not cross this interface. The
 * application layer depends on this contract rather than on Sokker's API.
 */
export interface SokkerDataProvider {
  getCurrent(): Promise<SokkerCurrentApiDto>;
  getTraining(): Promise<SokkerTrainingApiDto>;
  getTrainers(): Promise<SokkerTrainersApiDto>;
  getJuniors(): Promise<SokkerJuniorsApiDto>;
  getTrainingSummary(): Promise<SokkerTrainingSummaryApiDto>;
}

import type { SokkerImportResultDto } from "../types.js";
import type { SokkerDataProvider } from "./SokkerDataProvider.js";
import {
  mapApiCurrentToClubProfile,
  mapApiJuniorToSokkerJuniorDto,
  mapApiTrainingPlayerToPlayerTrainingWeekDto,
  mapApiTrainingPlayerToSokkerPlayerDto
} from "./api/mappers.js";

type TeamDataProvider = Pick<SokkerDataProvider, "getCurrent" | "getTraining" | "getJuniors">;

export async function assembleSokkerTeamData(
  provider: TeamDataProvider
): Promise<SokkerImportResultDto> {
  const [current, training, juniors] = await Promise.all([
    provider.getCurrent(),
    provider.getTraining(),
    provider.getJuniors()
  ]);

  return {
    clubProfile: mapApiCurrentToClubProfile(current),
    players: training.players.map(mapApiTrainingPlayerToSokkerPlayerDto),
    juniors: juniors.juniors.map(mapApiJuniorToSokkerJuniorDto),
    importedAt: new Date(),
    training: training.players.map(mapApiTrainingPlayerToPlayerTrainingWeekDto)
  };
}

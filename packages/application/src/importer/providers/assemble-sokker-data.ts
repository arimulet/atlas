import type { SokkerImportResultDto } from "../types.js";
import type { SokkerDataProvider } from "./SokkerDataProvider.js";

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
    current,
    players: training.players,
    juniors,
    importedAt: new Date(),
    training: training.trainingWeeks
  };
}

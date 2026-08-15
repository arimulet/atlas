import type { SokkerImportResultDto } from "../types.js";
import type { SokkerDataProvider } from "./SokkerDataProvider.js";
import { mapSokkerTeamToClubProfile } from "../mappers.js";

type TeamDataProvider = Pick<
  SokkerDataProvider,
  "getCurrent" | "getTeam" | "getPlayers" | "getJuniors" | "getCountries"
>;

export async function assembleSokkerTeamData(
  provider: TeamDataProvider,
  source: string
): Promise<SokkerImportResultDto> {
  const current = await provider.getCurrent();
  const teamId = current.teamId;

  if (teamId === undefined) {
    throw new Error("The Sokker provider did not provide a team ID.");
  }

  const [team, players, juniors, countries] = await Promise.all([
    provider.getTeam(teamId),
    provider.getPlayers(teamId),
    provider.getJuniors(teamId),
    provider.getCountries()
  ]);

  return {
    clubProfile: mapSokkerTeamToClubProfile(team, current),
    players,
    juniors,
    source,
    importedAt: new Date(),
    countries
  };
}

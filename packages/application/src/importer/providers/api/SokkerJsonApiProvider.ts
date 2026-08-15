import type {
  SokkerCountryDto,
  SokkerCurrentDto,
  SokkerJuniorDto,
  SokkerLeagueDto,
  SokkerMatchPlayerStatsDto,
  SokkerMatchSummaryDto,
  SokkerPlayerDto,
  SokkerImportResultDto,
  SokkerTeamDto
} from "../../types.js";
import type { SokkerCredentials } from "../../types.js";
import type { SokkerDataProvider } from "../SokkerDataProvider.js";
import { assembleSokkerTeamData } from "../assemble-sokker-data.js";
import { SokkerApiClient } from "./SokkerApiClient.js";
import type {
  SokkerApiCountryDto,
  SokkerApiCurrentDto,
  SokkerApiJuniorDto,
  SokkerApiLeagueDto,
  SokkerApiMatchDto,
  SokkerApiMatchPlayerStatsDto,
  SokkerApiPlayerDto,
  SokkerApiTeamDto
} from "./dtos.js";
import {
  mapApiCountryToSokkerCountryDto,
  mapApiCurrentToSokkerCurrentDto,
  mapApiJuniorToSokkerJuniorDto,
  mapApiLeagueToSokkerLeagueDto,
  mapApiMatchPlayerStatsToSokkerMatchPlayerStatsDto,
  mapApiMatchToSokkerMatchSummaryDto,
  mapApiPlayerToSokkerPlayerDto,
  mapApiTeamToSokkerTeamDto
} from "./mappers.js";

export class SokkerJsonApiProvider implements SokkerDataProvider {
  private readonly client: SokkerApiClient;

  constructor(client: SokkerApiClient);
  constructor(credentials: SokkerCredentials, client?: SokkerApiClient);
  constructor(clientOrCredentials: SokkerApiClient | SokkerCredentials, client?: SokkerApiClient) {
    if (isSokkerCredentials(clientOrCredentials)) {
      this.client = client ?? new SokkerApiClient({ credentials: clientOrCredentials });
      return;
    }

    this.client = clientOrCredentials;
  }

  async getFullTeamData(): Promise<SokkerImportResultDto> {
    return assembleSokkerTeamData(this, "sokker-json-api-import");
  }

  async getCurrent(): Promise<SokkerCurrentDto> {
    const response = await this.client.get<SokkerApiCurrentDto>("current");

    return mapApiCurrentToSokkerCurrentDto(response);
  }

  async getTeam(teamId: number): Promise<SokkerTeamDto> {
    const response = await this.client.get<SokkerApiTeamDto>(`teams/${teamId}`);

    return mapApiTeamToSokkerTeamDto(response);
  }

  async getPlayers(teamId: number): Promise<SokkerPlayerDto[]> {
    const response = await this.client.get<SokkerApiPlayerDto[]>(`teams/${teamId}/players`);

    return response.map(mapApiPlayerToSokkerPlayerDto);
  }

  async getJuniors(teamId: number): Promise<SokkerJuniorDto[]> {
    const response = await this.client.get<SokkerApiJuniorDto[]>(`teams/${teamId}/juniors`);

    return response.map(mapApiJuniorToSokkerJuniorDto);
  }

  async getCountries(): Promise<SokkerCountryDto[]> {
    const response = await this.client.get<SokkerApiCountryDto[]>("countries");

    return response.map(mapApiCountryToSokkerCountryDto);
  }

  async getMatches(teamId: number): Promise<SokkerMatchSummaryDto[]> {
    const response = await this.client.get<SokkerApiMatchDto[]>(`teams/${teamId}/matches`);

    return response.map(mapApiMatchToSokkerMatchSummaryDto);
  }

  async getMatch(matchId: number): Promise<SokkerMatchSummaryDto> {
    const response = await this.client.get<SokkerApiMatchDto>(`matches/${matchId}`);

    return mapApiMatchToSokkerMatchSummaryDto(response);
  }

  async getMatchLineup(matchId: number, teamId?: number): Promise<SokkerMatchPlayerStatsDto[]> {
    const response = await this.client.get<SokkerApiMatchPlayerStatsDto[]>(
      `matches/${matchId}/lineup`,
      teamId === undefined ? undefined : { teamId }
    );

    return response.map(mapApiMatchPlayerStatsToSokkerMatchPlayerStatsDto);
  }

  async getLeague(leagueId: number): Promise<SokkerLeagueDto> {
    const response = await this.client.get<SokkerApiLeagueDto>(`leagues/${leagueId}`);

    return mapApiLeagueToSokkerLeagueDto(response);
  }
}

function isSokkerCredentials(value: unknown): value is SokkerCredentials {
  return (
    typeof value === "object" &&
    value !== null &&
    "login" in value &&
    "password" in value &&
    typeof value.login === "string" &&
    typeof value.password === "string"
  );
}

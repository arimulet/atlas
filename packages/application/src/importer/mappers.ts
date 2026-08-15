import type { SokkerClubProfileDto, SokkerCurrentDto, SokkerTeamDto } from "./types.js";

export function mapSokkerTeamToClubProfile(
  team: SokkerTeamDto,
  current: SokkerCurrentDto
): SokkerClubProfileDto {
  return {
    externalId: String(team.id),
    name: team.name,
    countryId: team.countryId,
    money: team.money,
    season: team.season ?? current.season,
    gameWeek: current.gameWeek,
    week: current.week,
    training: team.training
  };
}

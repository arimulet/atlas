import { normalizeSeasonWeek } from "@atlas/domain";

import type {
  SokkerCountryDto,
  SokkerCurrentDto,
  SokkerJuniorDto,
  SokkerLeagueDto,
  SokkerMatchPlayerStatsDto,
  SokkerMatchSummaryDto,
  SokkerPlayerDto,
  SokkerTeamDto
} from "../../types.js";
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

export function mapApiCurrentToSokkerCurrentDto(input: SokkerApiCurrentDto): SokkerCurrentDto {
  return {
    gameWeek: input.gameWeek,
    week: normalizeSeasonWeek(input.gameWeek),
    season: input.season,
    teamId: input.teamId
  };
}

export function mapApiTeamToSokkerTeamDto(input: SokkerApiTeamDto): SokkerTeamDto {
  return {
    id: input.id,
    name: input.name,
    countryId: input.countryId,
    money: { amount: input.money, currency: null },
    season: input.season,
    training: {
      gk: input.training.gk ?? null,
      def: input.training.def ?? null,
      mid: input.training.mid ?? null,
      att: input.training.att ?? null
    }
  };
}

export function mapApiPlayerToSokkerPlayerDto(input: SokkerApiPlayerDto): SokkerPlayerDto {
  return {
    playerId: input.playerId,
    name: input.name,
    age: input.age,
    wage: input.wage,
    value: input.value,
    training: input.training,
    form: input.form ?? 10,
    availabilityStatus: "available",
    observedPosition: null,
    skills: {
      stamina: input.skills.stamina,
      pace: input.skills.pace,
      technique: input.skills.technique,
      passing: input.skills.passing,
      keeper: input.skills.keeper,
      defender: input.skills.defender,
      playmaker: input.skills.playmaker,
      striker: input.skills.striker
    }
  };
}

export function mapApiJuniorToSokkerJuniorDto(input: SokkerApiJuniorDto): SokkerJuniorDto {
  return {
    playerId: input.playerId,
    name: input.name,
    age: input.age,
    initialWeeksRemaining: input.weeksRemaining,
    weeksRemaining: input.weeksRemaining,
    skill: input.skill,
    status: "in_academy"
  };
}

export function mapApiCountryToSokkerCountryDto(input: SokkerApiCountryDto): SokkerCountryDto {
  return input;
}

export function mapApiMatchToSokkerMatchSummaryDto(
  input: SokkerApiMatchDto
): SokkerMatchSummaryDto {
  return {
    ...input,
    playedAt: input.playedAt ? new Date(input.playedAt) : null
  };
}

export function mapApiMatchPlayerStatsToSokkerMatchPlayerStatsDto(
  input: SokkerApiMatchPlayerStatsDto
): SokkerMatchPlayerStatsDto {
  return {
    ...input,
    rating: input.rating ?? null,
    timePlaying: input.timePlaying ?? null,
    timeDefending: input.timeDefending ?? null
  };
}

export function mapApiLeagueToSokkerLeagueDto(input: SokkerApiLeagueDto): SokkerLeagueDto {
  return input;
}

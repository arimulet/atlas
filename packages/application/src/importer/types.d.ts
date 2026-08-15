import type { PlayerSnapshotV0 } from "@atlas/contracts";

import type { Money } from "../types.js";

export type SokkerDataSource = "xml" | "json-api";

export interface SokkerCredentials {
  login: string;
  password: string;
}

export interface SokkerAuthResult {
  sessionId: string;
  teamId: string;
}

export interface SokkerCurrentDto {
  gameWeek: number;
  week: number;
  season?: number;
  teamId?: number;
}

export interface SokkerTeamDto {
  id: number;
  name: string;
  countryId: number;
  money: Money;
  season?: number;
  training: {
    gk: number | null;
    def: number | null;
    mid: number | null;
    att: number | null;
  };
}

export type SokkerPlayerDto = PlayerSnapshotV0["players"][number];
export type SokkerJuniorDto = NonNullable<PlayerSnapshotV0["juniors"]>[number];

export interface SokkerCountryDto {
  id: number;
  name: string;
  currencyName: string;
  currencyRate: number;
}

export interface SokkerClubProfileDto {
  externalId: string;
  name: string;
  countryId: number;
  money: Money;
  season?: number;
  gameWeek: number;
  week: number;
  training?: SokkerTeamDto["training"] | null;
}

export interface SokkerMatchSummaryDto {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  leagueId: number;
  gameWeek: number;
  playedAt: Date | null;
  homeScore: number;
  awayScore: number;
  isFinished: boolean;
}

export interface SokkerMatchPlayerStatsDto {
  playerId: number;
  number: number;
  formation: number;
  timeIn: number;
  timeOut: number;
  rating: number | null;
  timePlaying: number | null;
  timeDefending: number | null;
}

export interface SokkerLeagueDto {
  id: number;
  name: string;
  type: number;
  isOfficial: boolean;
}

export interface SokkerImportResultDto {
  clubProfile: SokkerClubProfileDto;
  players: SokkerPlayerDto[];
  juniors: SokkerJuniorDto[];
  source: string;
  importedAt: Date;
  countries: SokkerCountryDto[];
}

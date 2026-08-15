export interface SokkerApiCurrentDto {
  gameWeek: number;
  season?: number;
  teamId?: number;
}

export interface SokkerApiTeamDto {
  id: number;
  name: string;
  countryId: number;
  money: number;
  season?: number;
  training: {
    gk?: number;
    def?: number;
    mid?: number;
    att?: number;
  };
}

export interface SokkerApiPlayerDto {
  playerId: number;
  name: string;
  age: number;
  wage: number;
  value: number;
  training: { position: number; advanced: boolean };
  form?: number | null;
  skills: {
    stamina?: number;
    pace?: number;
    technique?: number;
    passing?: number;
    keeper?: number;
    defender?: number;
    playmaker?: number;
    striker?: number;
  };
}

export interface SokkerApiJuniorDto {
  playerId: number;
  name: string;
  age: number;
  weeksRemaining: number;
  skill: number;
}

export interface SokkerApiCountryDto {
  id: number;
  name: string;
  currencyName: string;
  currencyRate: number;
}

export interface SokkerApiMatchDto {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  leagueId: number;
  gameWeek: number;
  playedAt: string | null;
  homeScore: number;
  awayScore: number;
  isFinished: boolean;
}

export interface SokkerApiMatchPlayerStatsDto {
  playerId: number;
  number: number;
  formation: number;
  timeIn: number;
  timeOut: number;
  rating?: number | null;
  timePlaying?: number | null;
  timeDefending?: number | null;
}

export interface SokkerApiLeagueDto {
  id: number;
  name: string;
  type: number;
  isOfficial: boolean;
}

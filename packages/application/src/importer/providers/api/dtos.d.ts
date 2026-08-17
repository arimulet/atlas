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

export interface SokkerApiSkillsDto {
  stamina?: number;
  keeper?: number;
  playmaking?: number;
  passing?: number;
  technique?: number;
  defending?: number;
  striker?: number;
  pace?: number;
  form?: number;
  tacticalDiscipline?: number;
  teamwork?: number;
  experience?: number;
}

export interface SokkerApiSkillChangesDto extends SokkerApiSkillsDto {
  up: number;
  down: number;
}

export interface SokkerApiTrainingReportDto {
  week: number;
  day: {
    season: number;
    week: number;
    seasonWeek: number;
    day?: number;
    date: { value: string; timestamp?: number };
  };
  skills: SokkerApiSkillsDto;
  skillsChange: SokkerApiSkillChangesDto;
  type: { code: number; name: string };
  kind: { code: number; name: string };
  games: {
    minutesOfficial: number;
    minutesFriendly: number;
    minutesNational: number;
  };
  intensity: number;
  formation: { code: number; name: string } | null;
  age: number;
}

export interface SokkerApiTrainingPlayerDto {
  id: number;
  player?: SokkerApiPlayerDto;
  report: SokkerApiTrainingReportDto;
}

export interface SokkerApiTrainingResponseDto {
  players: SokkerApiTrainingPlayerDto[];
}

export interface SokkerApiDateDto {
  value: string;
  timestamp: number;
}

export interface SokkerApiDayDto {
  season: number;
  week: number;
  seasonWeek: number;
  day: number;
  date: SokkerApiDateDto;
}

export interface SokkerApiNameDto {
  name: string;
  surname: string;
  full: string;
}

export interface SokkerApiCountryDto {
  code: number;
  name: string;
}

export interface SokkerApiMoneyDto {
  value: number;
  currency: string;
}

export interface SokkerApiTeamDto {
  id: number;
  name: string;
  rank: number;
  rankPosition: number;
  emblem: string;
  country: SokkerApiCountryDto;
  colors: unknown;
  nationalType: number;
  bankrupt: boolean;
  league: unknown | null;
  rankTrend: unknown | null;
}

export interface SokkerApiCurrentDto {
  id: number;
  name: string;
  team: SokkerApiTeamDto;
  budget: SokkerApiMoneyDto;
  roles: unknown[];
  plus: boolean;
  hasTrialPlus: boolean;
  hasSubscription: boolean;
  plusDeadline: unknown | null;
  subscriptionNextPayment: unknown | null;
  today: SokkerApiDayDto;
  dateTime: unknown;
  enabledFeatures: string[];
  sl: string;
  nationalTeamId: number;
  nationalTeam: unknown | null;
  firstLogin: boolean;
  lock: {
    transfersLocked: boolean;
    readOnlyMode: boolean;
  };
  settings: {
    locale: string;
    theme: string;
  };
  bankruptDeadline: unknown | null;
}

export interface SokkerPlayerSkillsApiDto {
  form: number;
  tacticalDiscipline: number;
  teamwork: number;
  experience: number;
  stamina: number;
  keeper: number;
  playmaking: number;
  passing: number;
  technique: number;
  defending: number;
  striker: number;
  pace: number;
}

export interface SokkerSkillsChangeApiDto extends SokkerPlayerSkillsApiDto {
  down: number;
  up: number;
}

export interface SokkerApiFormationDto {
  code: number;
  name: string;
}

export interface SokkerApiInjuryDto {
  daysRemaining: number;
  severe: boolean;
}

export interface SokkerTrainingPlayerInfoApiDto {
  name: SokkerApiNameDto;
  formation: SokkerApiFormationDto | null;
  number: number | null;
  team: {
    id: number;
  };
  country: SokkerApiCountryDto;
  value: SokkerApiMoneyDto;
  previousValue: SokkerApiMoneyDto | null;
  wage: SokkerApiMoneyDto;
  characteristics: {
    age: number;
    height: number;
    weight: number;
    bmi: number;
  };
  skills: SokkerPlayerSkillsApiDto;
  stats: unknown;
  nationalStats: unknown;
  face: unknown;
  youthTeamId: number;
  injury: SokkerApiInjuryDto;
  nationalSharing: boolean;
  nationalCallUp: boolean;
  nationalType: string;
}

export interface SokkerTrainingReportApiDto {
  week: number;
  day: SokkerApiDayDto;
  skills: SokkerPlayerSkillsApiDto;
  skillsChange: SokkerSkillsChangeApiDto;
  type: SokkerApiFormationDto;
  kind: SokkerApiFormationDto;
  playerValue: SokkerApiMoneyDto;
  games: {
    minutesOfficial: number;
    minutesFriendly: number;
    minutesNational: number;
  };
  intensity: number;
  formation: SokkerApiFormationDto | null;
  injury: SokkerApiInjuryDto;
  age: number;
}

export interface SokkerApiTrainingPlayerDto {
  id: number;
  player: SokkerTrainingPlayerInfoApiDto;
  report: SokkerTrainingReportApiDto;
}

export interface SokkerTrainingApiDto {
  players: SokkerApiTrainingPlayerDto[];
}

export interface SokkerTrainerSkillApiDto {
  value: number;
  percent: number;
}

export interface SokkerTrainerSkillsApiDto {
  stamina: SokkerTrainerSkillApiDto;
  keeper: SokkerTrainerSkillApiDto;
  playmaking: SokkerTrainerSkillApiDto;
  passing: SokkerTrainerSkillApiDto;
  technique: SokkerTrainerSkillApiDto;
  defending: SokkerTrainerSkillApiDto;
  striker: SokkerTrainerSkillApiDto;
  pace: SokkerTrainerSkillApiDto;
  averagePercent: number;
}

export interface SokkerTrainerInfoApiDto {
  fullName: SokkerApiNameDto;
  assignment: SokkerApiFormationDto;
  contracted: boolean;
  salary: SokkerApiMoneyDto;
  country: SokkerApiCountryDto;
  age: number;
  skills: SokkerTrainerSkillsApiDto;
  status: string;
}

export interface SokkerTrainerApiDto {
  id: number;
  teamId: number;
  info: SokkerTrainerInfoApiDto;
  fullName?: SokkerApiNameDto;
  assignment?: SokkerApiFormationDto;
  contracted?: boolean;
  salary?: SokkerApiMoneyDto;
  country?: SokkerApiCountryDto;
  age?: number;
  skills?: SokkerTrainerSkillsApiDto;
  status?: string;
}

export interface SokkerTrainersApiDto {
  trainers: SokkerTrainerApiDto[];
}

export interface SokkerJuniorApiDto {
  id: number;
  teamId: number;
  name: string;
  fullName: SokkerApiNameDto;
  skill: number;
  age: number;
  weeksLeft: number;
}

export interface SokkerJuniorsApiDto {
  juniors: SokkerJuniorApiDto[];
}

export interface SokkerTrainingSummaryWeekApiDto {
  gameDay: SokkerApiDayDto;
  week: number;
  stats: {
    general: number;
    advanced: number;
    skillsUp: number;
  };
  juniors: {
    number: number;
    skillsUp: number;
  };
}

export interface SokkerTrainingSummaryApiDto {
  weeks: SokkerTrainingSummaryWeekApiDto[];
}

export type SokkerCurrentApiDto = SokkerApiCurrentDto;

import type { SkillChange, TrainingKind, TrainingType } from "@atlas/domain";

export type { TrainingKind, TrainingType } from "@atlas/domain";

export interface SokkerCredentials {
  login: string;
  password: string;
}

export interface CurrentClubContextDto {
  userId: number;
  userName: string;
  team: {
    id: number;
    name: string;
    rank: number;
    rankPosition: number;
    country: {
      code: number;
      name: string;
    };
    bankrupt: boolean;
  };
  budget: {
    value: number;
    currency: string;
  };
  training: {
    GK: number;
    DEF: number;
    MID: number;
    ATT: number;
  };
  calendar: {
    season: number;
    gameWeek: number;
    seasonWeek: number;
    date: string;
  };
}

export type PlayerFormation = "GK" | "DEF" | "MID" | "ATT";

export interface PlayerNameDto {
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface CountryDto {
  code: number;
  name: string;
}

export interface MoneyDto {
  value: number;
  currency: string;
}

export interface PlayerSkillsDto {
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

export interface PlayerSkillsChangeDto extends PlayerSkillsDto {
  up: number;
  down: number;
}

export interface PlayerDto {
  id: number;
  teamId: number;
  name: PlayerNameDto;
  country: CountryDto;
  value: MoneyDto;
  wage: MoneyDto;
  age: number;
  height: number;
  weight: number;
  bmi: number;
  skills: PlayerSkillsDto;
  formation: PlayerFormation | null;
  injury: {
    daysRemaining: number;
    severe: boolean;
  };
  cards: {
    yellow: number;
    red: number;
  };
  youthTeamId: number;
  nationalCallUp: boolean;
  nationalType: string;
}

export interface PlayerTrainingWeekDto {
  playerId: number;
  gameWeek: number;
  season: number;
  seasonWeek: number;
  date: string;
  trainedSkill: TrainingType;
  kind: TrainingKind;
  intensity: number;
  formation: PlayerFormation | null;
  age: number;
  skills: PlayerSkillsDto;
  skillsChange: PlayerSkillsChangeDto;
  skillChanges: SkillChange[];
}

export interface TrainingDataDto {
  players: PlayerDto[];
  trainingWeeks: PlayerTrainingWeekDto[];
}

export type TrainerAssignment = "HEAD" | "ASSISTANT" | "YOUTH";

export interface TrainerSkillDto {
  level: number;
  effectivenessPercent: number;
}

export interface TrainerSkillsDto {
  stamina: TrainerSkillDto;
  keeper: TrainerSkillDto;
  playmaking: TrainerSkillDto;
  passing: TrainerSkillDto;
  technique: TrainerSkillDto;
  defending: TrainerSkillDto;
  striker: TrainerSkillDto;
  pace: TrainerSkillDto;
}

export interface TrainerDto {
  id: number;
  teamId: number;
  name: PlayerNameDto;
  assignment: TrainerAssignment;
  contracted: boolean;
  salary: MoneyDto;
  age: number;
  skills: TrainerSkillsDto;
  averageEffectivenessPercent: number;
  status: string;
}

export interface JuniorDto {
  id: number;
  teamId: number;
  name: PlayerNameDto;
  age: number;
  currentLevel: number;
  weeksLeft: number;
}

export interface TrainingSummaryWeekDto {
  gameWeek: number;
  season: number;
  seasonWeek: number;
  date: string;
  players: {
    formationTraining: number;
    advancedTraining: number;
    skillsUp: number;
  };
  juniors: {
    count: number;
    skillsUp: number;
  };
}

export interface TrainingSummaryDto {
  weeks: TrainingSummaryWeekDto[];
}

export interface JuniorMatchPlayerStatsDto {
  playerId: number;
  position: number | null;
  minutesPlayed: number;
  rating: number;
  goals: number;
  assists: number;
  shoots: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  isInjured: boolean;
  timeDefending: number;
}

export interface JuniorMatchDto {
  matchId: number;
  clubId: number;
  season: number;
  gameWeek: number;
  seasonWeek: number;
  dateExpected: string;
  isFinished: boolean;
  playerStats: JuniorMatchPlayerStatsDto[];
}

export interface SokkerSyncPayload {
  current: CurrentClubContextDto;
  players: PlayerDto[];
  trainingWeeks: PlayerTrainingWeekDto[];
  trainers: TrainerDto[];
  juniors: JuniorDto[];
  trainingSummary: TrainingSummaryDto;
  juniorMatches: JuniorMatchDto[];
}

export interface SokkerSyncValidationIssue {
  severity: "fatal" | "warning";
  code: string;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

export type SokkerSyncValidationError = SokkerSyncValidationIssue & { severity: "fatal" };
export type SokkerSyncWarning = SokkerSyncValidationIssue & { severity: "warning" };

export interface ValidatedSokkerSyncPayload {
  status: "valid";
  payload: SokkerSyncPayload;
  warnings: SokkerSyncWarning[];
}

export interface InvalidSokkerSyncPayload {
  status: "invalid";
  payload: null;
  errors: SokkerSyncValidationError[];
  warnings: SokkerSyncWarning[];
}

export type SokkerSyncValidationResult = ValidatedSokkerSyncPayload | InvalidSokkerSyncPayload;

export interface SokkerSyncPersistenceResult {
  syncRunId: string;
  teamId: number;
  gameWeek: number;
  usedTransaction: boolean;
  clubId: string;
  snapshotId: string;
  upserted: {
    players: number;
    playerSnapshots: number;
    trainingWeeks: number;
    trainers: number;
    juniors: number;
    trainingSummaryWeeks: number;
    juniorMatches: number;
  };
}

export interface SnapshotPlayerDto {
  playerId: number;
  name: string;
  age: number;
  wage: number;
  value: number;
  training: {
    position: number;
    advanced: boolean;
  };
  form: number | null;
  availabilityStatus: "available" | "injured";
  observedPosition: null;
  skills: {
    stamina: number;
    pace: number;
    technique: number;
    passing: number;
    keeper: number;
    defender: number;
    playmaker: number;
    striker: number;
  };
}

export interface SnapshotJuniorDto {
  playerId: number;
  name: string;
  age: number;
  weeksRemaining: number;
  skill: number;
  status: "in_academy";
}

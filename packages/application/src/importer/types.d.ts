import type { PlayerSnapshotV0 } from "@atlas/contracts";
import type {
  PlayerSkills,
  PlayerSkillsChange,
  TrainingKind,
  TrainingType
} from "@atlas/domain";

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

export interface PlayerTrainingWeekDto {
  playerId: number;
  gameWeek: number;
  seasonWeek: number;
  date: Date;
  type: TrainingType;
  kind: TrainingKind;
  intensity: number;
  age: number;
  skills: PlayerSkills;
  skillsChange: PlayerSkillsChange;
}

export interface SokkerImportResultDto {
  clubProfile: SokkerClubProfileDto;
  players: SokkerPlayerDto[];
  juniors: SokkerJuniorDto[];
  source: string;
  importedAt: Date;
  countries: SokkerCountryDto[];
  training?: PlayerTrainingWeekDto[];
}

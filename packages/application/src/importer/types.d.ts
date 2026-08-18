import type { PlayerSnapshotV0 } from "@atlas/contracts";
import type {
  PlayerSkills,
  PlayerSkillsChange,
  SkillChange,
  TrainingKind,
  TrainingType
} from "@atlas/domain";

import type { Money } from "../types.js";

export interface SokkerCredentials {
  login: string;
  password: string;
}

export interface SokkerCurrentDto {
  gameWeek: number;
  week: number;
  season?: number;
  teamId?: number;
}

export type SokkerPlayerDto = PlayerSnapshotV0["players"][number];
export type SokkerJuniorDto = NonNullable<PlayerSnapshotV0["juniors"]>[number];

export type SokkerTeamTrainingDto = {
  gk: number | null;
  def: number | null;
  mid: number | null;
  att: number | null;
};

export interface SokkerClubProfileDto {
  externalId: string;
  name: string;
  countryId: number;
  money: Money;
  season?: number;
  gameWeek: number;
  week: number;
  training?: SokkerTeamTrainingDto | null;
}

export interface PlayerTrainingWeekDto {
  playerId: number;
  gameWeek: number;
  season: number;
  seasonWeek: number;
  date: Date;
  type: TrainingType;
  kind: TrainingKind;
  intensity: number;
  age: number;
  skills: PlayerSkills;
  skillsChange: PlayerSkillsChange;
  skillChanges: SkillChange[];
}

export interface SokkerImportResultDto {
  clubProfile: SokkerClubProfileDto;
  players: SokkerPlayerDto[];
  juniors: SokkerJuniorDto[];
  importedAt: Date;
  training?: PlayerTrainingWeekDto[];
}

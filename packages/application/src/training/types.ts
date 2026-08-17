import type {
  PersistedClub,
  PersistedPlayerSnapshot,
  PersistedPlayerTrainingWeek
} from "@atlas/database";

export interface TrainingPageData {
  snapshotId: string | null;
  snapshotDate: string | null;
  configuration: PersistedClub["training"];
  players: TrainingPagePlayer[];
  history: PersistedPlayerTrainingWeek[];
}

export interface TrainingPagePlayer {
  id: string;
  name: string;
  age: number;
  form?: number | null;
  training: PersistedPlayerSnapshot["training"];
  latestReport: PersistedPlayerTrainingWeek | null;
}

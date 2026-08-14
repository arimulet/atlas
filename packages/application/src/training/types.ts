import type { PersistedClub, PersistedPlayerSnapshot } from "@atlas/database";

export interface TrainingPageData {
  snapshotId: string | null;
  snapshotDate: string | null;
  configuration: PersistedClub["training"];
  players: TrainingPagePlayer[];
}

export interface TrainingPagePlayer {
  id: string;
  name: string;
  age: number;
  training: PersistedPlayerSnapshot["training"];
}

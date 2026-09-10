import type {
  PersistedClub,
  PersistedPlayerSnapshot,
  PersistedPlayerTrainingWeek
} from "@atlas/database";
import type {
  AdvancedTrainingOptimization,
  PlayerTrainingRecommendation,
  TalentEstimate,
  WeeklyTrainingReport
} from "@atlas/domain";

export interface TrainingPageData {
  snapshotId: string | null;
  snapshotDate: string | null;
  configuration: PersistedClub["training"];
  players: TrainingPagePlayer[];
  history: PersistedPlayerTrainingWeek[];
}

export interface TrainingPagePlayer {
  id: string;
  playerId: number;
  name: string;
  countryName?: string | null;
  age: number;
  form?: number | null;
  training: PersistedPlayerSnapshot["training"];
  value: number;
  valueChange: number | null;
  latestReport: PersistedPlayerTrainingWeek | null;
  talentEstimate: TalentEstimate | null;
}

export interface WeeklyTrainingIntelligence {
  report: WeeklyTrainingReport;
  recommendations: PlayerTrainingRecommendation[];
  advancedOptimization: AdvancedTrainingOptimization;
}

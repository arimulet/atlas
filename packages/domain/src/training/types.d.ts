export type TrainingType = "formation" | "advanced";

export interface TrainingEfficiencyInput {
  officialMinutes: number;
  friendlyMinutes: number;
  advancedTraining: boolean;
}

export interface TrainingEfficiencyResult {
  equivalentMinutes: number;
  formationEfficiency: number;
  trainingEfficiency: number;
  trainingType: TrainingType;
}

export type SkillTrainingCostSkill =
  "pace" | "scoring" | "defending" | "technique" | "playmaking" | "passing";

export interface SkillTrainingCostInput {
  skill: SkillTrainingCostSkill;
  targetSkillLevel: number;
}

export interface SkillTrainingCostResult {
  skill: SkillTrainingCostSkill;
  targetSkillLevel: number;
  baseLevel: number;
  exponent: number;
  costFactor: number;
}

export type TrainingPosition = 0 | 1 | 2 | 3;

export type SkillProgressObservationStatus = "progressed" | "censored";

export type SkillProgressObservationConfidence = "high" | "medium" | "low";

export type EffectiveTrainingCyclesSource = "observed" | "assumed-full-effectiveness";

export interface SkillProgressObservationInput {
  playerId: number;
  skill: SkillTrainingCostSkill;
  fromLevel: number;
  toLevel: number;
  ageAtStart: number;
  ageAtEnd: number;
  trainingType: TrainingType | null;
  assignedPosition: TrainingPosition | null;
  calendarCycles: number;
  startSnapshotId: string;
  endSnapshotId: string;
  trainingEfficiencies?: readonly number[];
}

export interface SkillProgressObservation {
  playerId: number;
  skill: SkillTrainingCostSkill;
  status: SkillProgressObservationStatus;
  fromLevel: number;
  toLevel: number;
  levelDelta: number;
  ageAtStart: number;
  ageAtEnd: number;
  trainingType: TrainingType | null;
  assignedPosition: TrainingPosition | null;
  calendarCycles: number;
  effectiveTrainingCycles: number;
  effectiveTrainingCyclesSource: EffectiveTrainingCyclesSource;
  calendarWeeksPerLevel: number | null;
  effectiveWeeksPerLevel: number | null;
  startSnapshotId: string;
  endSnapshotId: string;
  confidence: SkillProgressObservationConfidence;
}

export type TalentProfileStatus = "sufficient_data" | "insufficient_data";

export type TalentProfileEffectiveTrainingCyclesSource = EffectiveTrainingCyclesSource | "mixed";

export interface TalentProfileInput {
  playerId: number;
  observations: readonly SkillProgressObservation[];
  minimumComparableObservations?: number;
}

export interface TalentProfileEvidenceReference {
  startSnapshotId: string;
  endSnapshotId: string;
}

export interface TalentProfileSegment {
  targetSkillLevel: number;
  ageAtStart: number;
  trainingType: TrainingType | null;
  assignedPosition: TrainingPosition | null;
  comparableObservationCount: number;
  evidence: TalentProfileEvidenceReference[];
  calendarWeeksPerLevel: number;
  effectiveWeeksPerLevel: number;
  effectiveTrainingCyclesSource: TalentProfileEffectiveTrainingCyclesSource;
  status: TalentProfileStatus;
  confidence: SkillProgressObservationConfidence;
}

export interface TalentSkillProfile {
  skill: SkillTrainingCostSkill;
  observations: SkillProgressObservation[];
  progressionCount: number;
  censoredCount: number;
  segments: TalentProfileSegment[];
}

export interface TalentProfile {
  playerId: number;
  minimumComparableObservations: number;
  skills: Record<SkillTrainingCostSkill, TalentSkillProfile>;
}

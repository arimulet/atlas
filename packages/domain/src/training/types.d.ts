export type TrainingKind = "advanced" | "formation" | "missing";

export type PlayerSkill =
  "stamina" | "keeper" | "playmaking" | "passing" | "technique" | "defending" | "striker" | "pace";

export type TrainingType = "general" | PlayerSkill;
export type PlayerSkills = Partial<Record<PlayerSkill, number>>;

export type Skill = PlayerSkill;

export type SkillChangeDirection = "up" | "down";

export interface SkillChange {
  skill: Skill;
  before: number;
  after: number;
  delta: number;
  direction: SkillChangeDirection;
}

export interface PlayerSkillsChange extends Partial<Record<PlayerSkill, number>> {
  up: number;
  down: number;
}

export type SkillTrainingCostSkill =
  "stamina" | "keeper" | "pace" | "scoring" | "defending" | "technique" | "playmaking" | "passing";

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

export interface RequiredTrainingPointsInput {
  talent: number;
  age: number;
  skill: SkillTrainingCostSkill;
  targetSkillLevel: number;
}

export interface RequiredTrainingPointsResult {
  talent: number;
  age: number;
  skill: SkillTrainingCostSkill;
  targetSkillLevel: number;
  ageCostFactor: number;
  skillCostFactor: number;
  baseTrainingPoints: number;
  requiredTrainingPoints: number;
}

export interface TalentEstimationInput {
  observedTrainingPoints: number;
  age: number;
  skill: SkillTrainingCostSkill;
  targetSkillLevel: number;
}

export interface TalentEstimationResult {
  observedTrainingPoints: number;
  age: number;
  skill: SkillTrainingCostSkill;
  targetSkillLevel: number;
  ageCostFactor: number;
  skillCostFactor: number;
  baseTrainingPoints: number;
  estimatedTalent: number;
}

export type TrainingSkillLevels = Partial<Record<SkillTrainingCostSkill, number>>;

export interface TrainingWeekInput {
  playerId: number;
  gameWeek: number;
  season?: number;
  seasonWeek: number;
  date: Date;
  type: TrainingType;
  kind: TrainingKind;
  intensity: number;
  age: number;
  skills: PlayerSkills;
  skillsChange: PlayerSkillsChange;
  skillChanges?: readonly SkillChange[];
  skill?: SkillTrainingCostSkill;
  skillLevelBefore?: number;
  skillLevelAfter?: number;
  skillLevelsBefore?: TrainingSkillLevels;
  skillLevelsAfter?: TrainingSkillLevels;
}

export interface TrainingWeek extends Omit<
  TrainingWeekInput,
  "skillLevelsBefore" | "skillLevelsAfter"
> {
  week: number;
  skill: SkillTrainingCostSkill;
  playerAge: number;
  skillLevelBefore: number;
  skillLevelAfter: number;
  skillLevelsBefore: TrainingSkillLevels;
  skillLevelsAfter: TrainingSkillLevels;
  trainingPoints: number;
  skillChanges: readonly SkillChange[];
}

export type PlayerTrainingWeek = TrainingWeek;

export interface TrainingHistory {
  playerId: number;
  weeks: readonly TrainingWeek[];
}

export interface WeeklyTrainingPlayerReport {
  playerId: number;
  gameWeek: number;
  training: {
    skill: SkillTrainingCostSkill;
    kind: "advanced" | "formation";
    intensity: number;
  };
  skill: {
    previousLevel: number;
    currentLevel: number;
    skillUp: boolean;
  };
  trainingPoints: {
    earned: number;
    estimatedProgress: number | null;
    remainingToNextLevel: number | null;
    estimatedWeeksToNextLevel: number | null;
  };
}

export interface WeeklyTrainingReport {
  gameWeek: number;
  date: Date;
  players: WeeklyTrainingPlayerReport[];
  summary: {
    trainedPlayers: number;
    advancedPlayers: number;
    formationPlayers: number;
    skillUps: number;
    averageIntensity: number;
  };
}

export interface WeeklyTrainingPlayerInput {
  history: TrainingHistory;
  talent?: number | null;
}

export interface WeeklyTrainingReportInput {
  players: readonly WeeklyTrainingPlayerInput[];
  gameWeek?: number;
  date?: Date;
  talents?: ReadonlyMap<number, number | null> | Readonly<Record<number, number | null>>;
}

export interface TalentEvidence {
  playerId: number;
  skill: Skill;
  fromLevel: number;
  toLevel: number;
  fromWeek: number;
  toWeek: number;
  trainingWeeks: number;
  accumulatedTrainingPoints: number;
  estimatedTalent: number;
  confidence: number;
}

export type TalentConfidence = "unknown" | "low" | "medium" | "high";

export interface TalentEstimate {
  value: number | null;
  confidence: TalentConfidence;
  evidenceCount: number;
  evidences: readonly TalentEvidence[];
}

export type SkillUpObservationCompleteness =
  "complete" | "left-censored" | "missing-weeks" | "ambiguous";

export interface SkillUp {
  playerId: number;
  skill: SkillTrainingCostSkill;
  fromLevel: number;
  toLevel: number;
  levelDelta: number;
  week: number;
}

export interface SkillUpObservation {
  playerId: number;
  skill: SkillTrainingCostSkill;
  fromLevel: number;
  toLevel: number;
  levelDelta: number;
  startWeek: number;
  popWeek: number;
  accumulatedTrainingPoints: number;
  weeksObserved: number;
  weeksWithRelevantTraining: number;
  ageAtStart: number;
  ageAtPop: number;
  completeness: SkillUpObservationCompleteness;
  eligibleForTalentEstimation: boolean;
  trainingWeeks: readonly TrainingWeek[];
}

export interface TalentObservation {
  playerId: number;
  skill: SkillTrainingCostSkill;
  fromLevel: number;
  toLevel: number;
  startWeek: number;
  popWeek: number;
  observedTrainingPoints: number;
  ageAtStart: number;
  ageAtPop: number;
  effectiveAge: number;
  effectiveAgeCostFactor: number;
  skillCostFactor: number;
  baseTrainingPoints: number;
  estimatedTalent: number;
  sourceObservation: SkillUpObservation;
}

export interface TalentObservationProfileInput {
  playerId: number;
  observations: readonly TalentObservation[];
  minimumObservations?: number;
}

export interface TalentObservationSkillProfile {
  skill: SkillTrainingCostSkill;
  observations: TalentObservation[];
  observationCount: number;
  targetSkillLevels: number[];
  medianEstimatedTalent: number | null;
  minimumEstimatedTalent: number | null;
  maximumEstimatedTalent: number | null;
  status: TalentProfileStatus;
}

export interface TalentObservationProfile {
  playerId: number;
  minimumObservations: number;
  skills: Record<SkillTrainingCostSkill, TalentObservationSkillProfile>;
}

export type ExpectedWeeksToSkillUpStatus = "calculable" | "insufficient_data";

export interface ExpectedWeeksToSkillUpInput {
  profile: TalentObservationProfile;
  skill: SkillTrainingCostSkill;
  age: number;
  currentSkillLevel: number;
}

export interface ExpectedWeeksToSkillUpResult {
  playerId: number;
  skill: SkillTrainingCostSkill;
  fromLevel: number;
  targetSkillLevel: number;
  age: number;
  talent: number | null;
  ageCostFactor: number | null;
  skillCostFactor: number | null;
  baseTrainingPoints: number;
  weeklyTrainingPoints: number;
  requiredTrainingPoints: number | null;
  expectedWeeks: number | null;
  sourceObservationCount: number;
  status: ExpectedWeeksToSkillUpStatus;
}

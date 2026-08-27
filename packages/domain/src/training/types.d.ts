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

export type TrainingRecommendationStatus = "continue" | "switch_skill" | "hold";
export type TrainingRecommendationConfidence = "low" | "medium" | "high";

export interface TrainingRecommendationPlayer {
  playerId: number;
  age: number;
  position: "goalkeeper" | "defender" | "midfielder" | "winger" | "striker" | null;
  skills: PlayerSkills;
}

export interface PlayerTrainingRecommendationContext {
  player: TrainingRecommendationPlayer;
  weeklyReport: WeeklyTrainingPlayerReport;
  trainingHistory: TrainingHistory | readonly TrainingHistory[];
  talent?: TalentEstimate | null;
}

export interface TrainingOptionEvaluation {
  skill: SkillTrainingCostSkill;
  currentLevel: number;
  estimatedWeeksToNextLevel: number | null;
  requiredTrainingPoints: number | null;
  expectedWeeklyTrainingPoints: number | null;
  developmentReturnScore: number | null;
}

export type TrainingRecommendationReason =
  | { type: "skill_up_soon"; estimatedWeeks: number }
  | {
      type: "better_alternative";
      currentSkill: SkillTrainingCostSkill;
      alternativeSkill: SkillTrainingCostSkill;
      improvement: number;
    }
  | { type: "recent_skill_up"; skill: SkillTrainingCostSkill }
  | { type: "high_next_level_cost"; skill: SkillTrainingCostSkill }
  | { type: "stable_current_skill"; skill: SkillTrainingCostSkill }
  | { type: "insufficient_history" }
  | { type: "no_valid_alternative" }
  | { type: "current_option_not_calculable" }
  | { type: "talent_uncertain" };

export interface PlayerTrainingRecommendation {
  playerId: number;
  status: TrainingRecommendationStatus;
  currentSkill: SkillTrainingCostSkill;
  recommendedSkill?: SkillTrainingCostSkill;
  currentOption: TrainingOptionEvaluation;
  alternatives: TrainingOptionEvaluation[];
  confidence: TrainingRecommendationConfidence;
  reasons: TrainingRecommendationReason[];
}

export interface DevelopmentReturnScoreInput {
  age: number;
  talent?: number | null;
  skill: SkillTrainingCostSkill;
  currentSkillLevel: number;
  expectedWeeklyTrainingPoints: number;
}

export interface TrainingOptionScoreBreakdown {
  skill: SkillTrainingCostSkill;
  level: number;
  requiredPoints: number;
  weeklyPoints: number;
  estimatedWeeks: number;
  developmentValue: number;
  ageCostFactor: number;
  skillCostFactor: number;
  talent: number;
  developmentReturnScore: number;
}

export interface TrainingPointsByKindInput {
  intensity: number;
  kind: "advanced" | "formation";
}

export interface AdvancedTrainingCandidateContext {
  player: TrainingRecommendationPlayer;
  weeklyReport?: WeeklyTrainingPlayerReport;
  trainingRecommendation?: PlayerTrainingRecommendation;
  trainingHistory: TrainingHistory | readonly TrainingHistory[];
  currentTraining: {
    skill: SkillTrainingCostSkill;
    kind: TrainingKind;
    intensity: number;
  };
  talent?: TalentEstimate | null;
  trial?: { projectedIntensity: number; academyTalent?: number | null };
}

export interface AdvancedSlotEvaluation {
  playerId: number;
  currentSkill: SkillTrainingCostSkill;
  advancedScore: number | null;
  expectedAdvancedTrainingPoints: number | null;
  expectedFormationTrainingPoints: number | null;
  marginalTrainingPoints: number | null;
  developmentPotentialScore: number | null;
  scoreBreakdown?: AdvancedScoreBreakdown;
  confidence: TrainingRecommendationConfidence;
}

export interface AdvancedScoreBreakdown {
  marginalTrainingGain: number;
  developmentPotential: number;
  talentContribution?: number;
  ageContribution: number;
  finalScore: number;
}

export interface AdvancedTrainingRankingEntry {
  playerId: number;
  rank: number;
  score: number | null;
  currentlyAdvanced: boolean;
  isTrial: boolean;
  recommendedAdvanced: boolean;
  confidence: TrainingRecommendationConfidence;
}

export type AdvancedTrainingRecommendation =
  | "keep_advanced"
  | "promote_to_advanced"
  | "trial_advanced"
  | "remove_from_advanced"
  | "keep_formation"
  | "hold";

export type AdvancedSlotReason =
  | { type: "high_marginal_training_gain"; value: number }
  | { type: "high_development_potential" }
  | { type: "low_development_potential" }
  | { type: "better_candidate_available"; playerId: number; scoreDifference: number }
  | { type: "within_recommended_top_slots"; rank: number }
  | { type: "below_advanced_cutoff"; rank: number }
  | { type: "difference_below_replacement_threshold" }
  | { type: "insufficient_data" }
  | { type: "new_player_trial_candidate" }
  | { type: "academy_talent_signal"; value: number }
  | { type: "projected_advanced_return"; value: number }
  | { type: "insufficient_senior_training_evidence" }
  | { type: "trial_slot_limit_reached" };

export interface AdvancedTrainingPlayerRecommendation {
  playerId: number;
  status: AdvancedTrainingRecommendation;
  currentlyAdvanced: boolean;
  recommendedAdvanced: boolean;
  evaluation: AdvancedSlotEvaluation;
  reasons: AdvancedSlotReason[];
}

export interface AdvancedSlotReplacement {
  promotePlayerId: number;
  removePlayerId: number;
  scoreDifference: number;
  confidence: TrainingRecommendationConfidence;
  reasons: AdvancedSlotReason[];
}

export interface AdvancedSlotScoreInput {
  marginalTrainingPoints: number;
  developmentPotentialScore: number;
}

export interface AdvancedTrainingOptimization {
  gameWeek: number;
  slotCount: number;
  ranking: AdvancedTrainingRankingEntry[];
  recommendedAdvancedPlayerIds: number[];
  recommendations: AdvancedTrainingPlayerRecommendation[];
  replacements: AdvancedSlotReplacement[];
  summary: {
    currentlyAdvanced: number;
    recommendedChanges: number;
    promotions: number;
    removals: number;
  };
}

export type CalibrationWarning =
  | "insufficient_history"
  | "missing_last_skill_up"
  | "prediction_error_high"
  | "unstable_talent_estimate"
  | "recommendation_flapping"
  | "advanced_rank_instability"
  | "inconsistent_training_history";

export type CalibrationConfidence = TrainingRecommendationConfidence;

export interface TrainingCalibrationEntry {
  playerId: number;
  gameWeek: number;
  observed: {
    skill: SkillTrainingCostSkill;
    previousLevel: number | null;
    currentLevel: number;
    skillUp: boolean;
    intensity: number;
  };
  estimated: {
    earnedTrainingPoints: number | null;
    progress: number | null;
    remainingTrainingPoints: number | null;
    weeksToNextSkillUp: number | null;
  };
  confidence: CalibrationConfidence;
  warnings: CalibrationWarning[];
}

export interface SkillUpBacktestPrediction {
  playerId: number;
  skill: SkillTrainingCostSkill;
  predictionWeek: number;
  observedSkillUpWeek: number;
  predictedWeeks: number | null;
  actualWeeks: number;
  errorWeeks: number | null;
}

export interface SkillUpBacktestSummary {
  samples: number;
  meanAbsoluteErrorWeeks: number | null;
  medianAbsoluteErrorWeeks: number | null;
  withinHalfWeek: number;
  withinOneWeek: number;
  withinTwoWeeks: number;
}

export interface RecommendationCalibrationObservation {
  playerId: number;
  gameWeek: number;
  currentSkill: SkillTrainingCostSkill;
  status: TrainingRecommendationStatus;
  recommendedSkill?: SkillTrainingCostSkill;
  currentScore: number | null;
  bestAlternativeScore: number | null;
  relativeImprovement: number | null;
  confidence: CalibrationConfidence;
}

export interface RankingStability {
  playerId: number;
  currentRank: number;
  previousRank: number | null;
  rankDelta: number | null;
}

export interface AdvancedTrainingCalibrationSummary {
  stableSlots: number;
  recommendedChanges: number;
  borderlinePlayers: number;
  rankingStability: RankingStability[];
  cutoff: Array<{ playerId: number; rank: number; score: number | null }>;
}

export interface CalibrationWarningSummary {
  warning: CalibrationWarning;
  count: number;
  playerIds: number[];
}

export interface TrainingCalibrationPlayerContext {
  player: TrainingRecommendationPlayer;
  trainingHistory: TrainingHistory;
  currentTraining?: AdvancedTrainingCandidateContext["currentTraining"];
  currentlyAdvanced?: boolean;
}

export type TrainingCalibrationScenario =
  | "young_with_long_history"
  | "young_with_short_history"
  | "high_talent_estimate"
  | "uncertain_talent"
  | "observed_skill_up"
  | "recent_skill_up"
  | "repeated_skill"
  | "changed_skill"
  | "advanced"
  | "formation"
  | "older_player";

export interface TrainingCalibrationDatasetSelection {
  analyzedPlayers: number;
  players: TrainingCalibrationPlayerContext[];
  scenarios: Array<{
    playerId: number;
    scenarios: TrainingCalibrationScenario[];
  }>;
}

export interface WeeklyTrainingCalibrationInput {
  players: readonly TrainingCalibrationPlayerContext[];
  datasetSelection?: TrainingCalibrationDatasetSelection;
  gameWeek?: number;
  weeklyReport?: WeeklyTrainingReport;
  recommendations?: readonly PlayerTrainingRecommendation[];
  advancedOptimization?: AdvancedTrainingOptimization;
  previousAdvancedRanking?: readonly AdvancedTrainingRankingEntry[];
}

export interface WeeklyTrainingCalibrationReport {
  gameWeek: number;
  dataset: {
    analyzedPlayers: number;
    selectedPlayers: number;
    scenarios: TrainingCalibrationDatasetSelection["scenarios"];
  };
  players: TrainingCalibrationEntry[];
  skillUpBacktest: SkillUpBacktestSummary;
  skillUpPredictions: SkillUpBacktestPrediction[];
  recommendations: {
    continue: number;
    switchSkill: number;
    hold: number;
    flappingDetected: number;
    observations: RecommendationCalibrationObservation[];
  };
  advancedTraining: AdvancedTrainingCalibrationSummary;
  warnings: CalibrationWarningSummary[];
  optionBreakdowns: TrainingOptionScoreBreakdown[];
  advancedScoreBreakdowns: Array<{
    playerId: number;
    breakdown: AdvancedScoreBreakdown;
  }>;
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

import {
  buildTrainingRecommendations,
  buildWeeklyTrainingReport,
  calculateDevelopmentReturnScore,
  calculateDevelopmentReturnScoreBreakdown,
  detectSkillUps,
  estimateTalentFromTrainingHistory,
  getTrainingWeeks,
  optimizeAdvancedTrainingSlots
} from "./index.js";
import {
  TRAINING_CALIBRATION_BORDERLINE_RANK_END,
  TRAINING_CALIBRATION_BORDERLINE_RANK_START,
  TRAINING_CALIBRATION_HIGH_PREDICTION_ERROR_WEEKS,
  TRAINING_CALIBRATION_MIN_FLAPPING_OBSERVATIONS,
  TRAINING_CALIBRATION_RANK_INSTABILITY_DELTA
} from "./constants.js";
import type {
  AdvancedTrainingOptimization,
  CalibrationWarning,
  CalibrationWarningSummary,
  DevelopmentReturnScoreInput,
  PlayerTrainingRecommendation,
  PlayerTrainingRecommendationContext,
  RankingStability,
  RecommendationCalibrationObservation,
  SkillTrainingCostSkill,
  SkillUpBacktestPrediction,
  SkillUpBacktestSummary,
  TalentEstimate,
  TrainingCalibrationDatasetSelection,
  TrainingCalibrationEntry,
  TrainingCalibrationPlayerContext,
  TrainingCalibrationScenario,
  TrainingHistory,
  TrainingOptionScoreBreakdown,
  WeeklyTrainingCalibrationInput,
  WeeklyTrainingCalibrationReport,
  WeeklyTrainingPlayerReport,
  WeeklyTrainingReport
} from "./types.js";

export function calculateSkillUpBacktestSummary(
  predictions: readonly SkillUpBacktestPrediction[]
): SkillUpBacktestSummary {
  const errors = predictions
    .map((prediction) => prediction.errorWeeks)
    .filter((error): error is number => error !== null && Number.isFinite(error));

  if (errors.length === 0) {
    return {
      samples: 0,
      meanAbsoluteErrorWeeks: null,
      medianAbsoluteErrorWeeks: null,
      withinHalfWeek: 0,
      withinOneWeek: 0,
      withinTwoWeeks: 0
    };
  }

  const ordered = [...errors].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const medianAbsoluteErrorWeeks =
    ordered.length % 2 === 0
      ? (ordered[middle - 1]! + ordered[middle]!) / 2
      : ordered[middle]!;

  return {
    samples: errors.length,
    meanAbsoluteErrorWeeks: errors.reduce((total, error) => total + error, 0) / errors.length,
    medianAbsoluteErrorWeeks,
    withinHalfWeek: errors.filter((error) => error <= 0.5).length,
    withinOneWeek: errors.filter((error) => error <= 1).length,
    withinTwoWeeks: errors.filter((error) => error <= 2).length
  };
}

export function selectTrainingCalibrationDataset(
  contexts: readonly TrainingCalibrationPlayerContext[],
  maximumPlayers = 12
): TrainingCalibrationDatasetSelection {
  if (!Number.isInteger(maximumPlayers) || maximumPlayers <= 0) {
    throw new Error("maximumPlayers must be a positive integer.");
  }

  const selected = new Map<number, TrainingCalibrationPlayerContext>();
  const scenarios = new Map<number, TrainingCalibrationScenario[]>();
  const addCandidate = (
    scenario: TrainingCalibrationScenario,
    candidate: TrainingCalibrationPlayerContext | undefined
  ) => {
    if (!candidate || selected.size >= maximumPlayers) {
      return;
    }
    selected.set(candidate.player.playerId, candidate);
    const playerScenarios = scenarios.get(candidate.player.playerId) ?? [];
    if (!playerScenarios.includes(scenario)) {
      playerScenarios.push(scenario);
    }
    scenarios.set(candidate.player.playerId, playerScenarios);
  };
  const available = [...contexts].sort(compareCalibrationContexts);
  const withHistory = (predicate: (context: TrainingCalibrationPlayerContext) => boolean) =>
    available.filter(predicate);
  const youngest = [...available].sort((left, right) => left.player.age - right.player.age)[0];
  const oldest = [...available].sort((left, right) => right.player.age - left.player.age)[0];
  const talentEstimates = available
    .map((context) => ({ context, talent: estimateTalentFromTrainingHistory(context.trainingHistory) }))
    .filter((entry) => entry.talent.value !== null)
    .sort((left, right) => (right.talent.value ?? 0) - (left.talent.value ?? 0));
  const latestWeek = Math.max(
    ...available.flatMap((context) => getTrainingWeeks(context.trainingHistory).map((week) => week.week))
  );

  addCandidate(
    "young_with_long_history",
    [...withHistory((context) => context.player.age === youngest?.player.age)].sort(
      (left, right) => right.trainingHistory.weeks.length - left.trainingHistory.weeks.length
    )[0]
  );
  addCandidate(
    "young_with_short_history",
    [...withHistory((context) => context.player.age === youngest?.player.age)].sort(
      (left, right) => left.trainingHistory.weeks.length - right.trainingHistory.weeks.length
    )[0]
  );
  addCandidate("high_talent_estimate", talentEstimates[0]?.context);
  addCandidate(
    "uncertain_talent",
    available.find((context) => {
      const estimate = estimateTalentFromTrainingHistory(context.trainingHistory);
      return estimate.value === null || estimate.confidence === "low" || estimate.confidence === "unknown";
    })
  );
  addCandidate(
    "observed_skill_up",
    available.find((context) => detectSkillUps(context.trainingHistory).length > 0)
  );
  addCandidate(
    "recent_skill_up",
    available.find((context) =>
      detectSkillUps(context.trainingHistory).some((skillUp) => skillUp.week === latestWeek)
    )
  );
  addCandidate(
    "repeated_skill",
    available.find((context) => {
      const skills = getTrainingWeeks(context.trainingHistory).map((week) => week.skill);
      return new Set(skills).size < skills.length;
    })
  );
  addCandidate(
    "changed_skill",
    available.find((context) => new Set(getTrainingWeeks(context.trainingHistory).map((week) => week.skill)).size > 1)
  );
  addCandidate("advanced", available.find((context) => context.currentTraining?.kind === "advanced"));
  addCandidate("formation", available.find((context) => context.currentTraining?.kind === "formation"));
  addCandidate("older_player", oldest);

  for (const context of available) {
    if (selected.size >= maximumPlayers) {
      break;
    }
    if (!selected.has(context.player.playerId)) {
      selected.set(context.player.playerId, context);
    }
  }

  for (const context of selected.values()) {
    if (!scenarios.has(context.player.playerId)) {
      scenarios.set(context.player.playerId, []);
    }
  }
  return {
    analyzedPlayers: contexts.length,
    players: [...selected.values()],
    scenarios: [...scenarios.entries()]
      .map(([playerId, playerScenarios]) => ({ playerId, scenarios: playerScenarios }))
      .sort((left, right) => left.playerId - right.playerId)
  };
}

export function detectRecommendationFlapping(
  observations: readonly RecommendationCalibrationObservation[]
): number[] {
  const flappingPlayers = new Set<number>();
  const byPlayer = new Map<number, RecommendationCalibrationObservation[]>();

  for (const observation of observations) {
    const playerObservations = byPlayer.get(observation.playerId) ?? [];
    playerObservations.push(observation);
    byPlayer.set(observation.playerId, playerObservations);
  }

  for (const [playerId, playerObservations] of byPlayer) {
    const ordered = [...playerObservations].sort((left, right) => left.gameWeek - right.gameWeek);
    if (ordered.length < TRAINING_CALIBRATION_MIN_FLAPPING_OBSERVATIONS) {
      continue;
    }

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]!;
      const current = ordered[index]!;
      if (
        previous.status === "switch_skill" &&
        current.status === "switch_skill" &&
        previous.recommendedSkill === current.currentSkill &&
        current.recommendedSkill === previous.currentSkill
      ) {
        flappingPlayers.add(playerId);
      }
    }
  }

  return [...flappingPlayers].sort((left, right) => left - right);
}

export function calculateRankingStability(
  currentRanking: readonly { playerId: number; rank: number }[],
  previousRanking: readonly { playerId: number; rank: number }[] | undefined
): RankingStability[] {
  const previousByPlayer = new Map(
    (previousRanking ?? []).map((entry) => [entry.playerId, entry.rank])
  );

  return currentRanking.map((entry) => {
    const previousRank = previousByPlayer.get(entry.playerId) ?? null;
    return {
      playerId: entry.playerId,
      currentRank: entry.rank,
      previousRank,
      rankDelta: previousRank === null ? null : entry.rank - previousRank
    };
  });
}

export function buildTalentSensitivity(input: {
  scoreInput: Omit<DevelopmentReturnScoreInput, "talent">;
  talent: number;
  uncertainty: number;
}): Array<{ talent: number; developmentReturnScore: number | null }> {
  if (
    !Number.isFinite(input.talent) ||
    input.talent <= 0 ||
    !Number.isFinite(input.uncertainty) ||
    input.uncertainty < 0
  ) {
    throw new Error("Talent and uncertainty must be finite, with positive talent and non-negative uncertainty.");
  }
  const values = [
    Math.max(Number.EPSILON, input.talent - input.uncertainty),
    input.talent,
    input.talent + input.uncertainty
  ];
  return values.map((talent) => ({
    talent,
    developmentReturnScore: calculateDevelopmentReturnScore({ ...input.scoreInput, talent })
  }));
}

export function buildWeeklyTrainingCalibrationReport(
  input: WeeklyTrainingCalibrationInput
): WeeklyTrainingCalibrationReport {
  if (input.players.length === 0) {
    throw new Error("At least one player is required for training calibration.");
  }

  const gameWeek = input.gameWeek ?? latestGameWeek(input.players);
  const talentByPlayer = new Map<number, TalentEstimate>();
  for (const context of input.players) {
    talentByPlayer.set(context.player.playerId, estimateTalentFromTrainingHistory(context.trainingHistory));
  }

  const weeklyReport =
    input.weeklyReport ??
    buildWeeklyTrainingReport({
      players: input.players.map((context) => ({
        history: context.trainingHistory,
        talent: talentByPlayer.get(context.player.playerId)?.value
      })),
      gameWeek
    });
  const reportByPlayer = new Map(weeklyReport.players.map((report) => [report.playerId, report]));
  const currentEntryByPlayer = new Map<number, TrainingCalibrationEntry>();
  const currentWarnings = new Map<number, CalibrationWarning[]>();

  for (const context of input.players) {
    const report = reportByPlayer.get(context.player.playerId);
    if (!report) {
      continue;
    }

    const talent = talentByPlayer.get(context.player.playerId);
    const warnings = calibrationWarnings(context.trainingHistory, report, talent);
    currentWarnings.set(context.player.playerId, warnings);
    currentEntryByPlayer.set(context.player.playerId, {
      playerId: report.playerId,
      gameWeek: report.gameWeek,
      observed: {
        skill: report.training.skill,
        previousLevel: report.skill.previousLevel,
        currentLevel: report.skill.currentLevel,
        skillUp: report.skill.skillUp,
        intensity: report.training.intensity
      },
      estimated: {
        earnedTrainingPoints: report.trainingPoints.earned,
        progress: report.trainingPoints.estimatedProgress,
        remainingTrainingPoints: report.trainingPoints.remainingToNextLevel,
        weeksToNextSkillUp: report.trainingPoints.estimatedWeeksToNextLevel
      },
      confidence: calibrationConfidence(context.trainingHistory, report, talent),
      warnings
    });
  }

  const skillUpPredictions = input.players.flatMap((context) =>
    buildSkillUpBacktestPredictions(context)
  );
  const recommendationObservations = input.players.flatMap((context) =>
    buildRecommendationObservations(context)
  );
  const flappingPlayers = detectRecommendationFlapping(recommendationObservations);
  for (const playerId of flappingPlayers) {
    const entry = currentEntryByPlayer.get(playerId);
    if (entry && !entry.warnings.includes("recommendation_flapping")) {
      entry.warnings.push("recommendation_flapping");
    }
  }

  const advancedOptimization =
    input.advancedOptimization ?? buildAdvancedOptimization(input.players, weeklyReport, gameWeek);
  const rankingStability = calculateRankingStability(
    advancedOptimization.ranking,
    input.previousAdvancedRanking
  );
  const unstableRankPlayers = rankingStability
    .filter(
      (entry) =>
        entry.rankDelta !== null &&
        Math.abs(entry.rankDelta) >= TRAINING_CALIBRATION_RANK_INSTABILITY_DELTA
    )
    .map((entry) => entry.playerId);
  for (const playerId of unstableRankPlayers) {
    const entry = currentEntryByPlayer.get(playerId);
    if (entry && !entry.warnings.includes("advanced_rank_instability")) {
      entry.warnings.push("advanced_rank_instability");
    }
  }

  for (const prediction of skillUpPredictions) {
    if (
      prediction.errorWeeks !== null &&
      prediction.errorWeeks >= TRAINING_CALIBRATION_HIGH_PREDICTION_ERROR_WEEKS
    ) {
      const entry = currentEntryByPlayer.get(prediction.playerId);
      if (entry && !entry.warnings.includes("prediction_error_high")) {
        entry.warnings.push("prediction_error_high");
      }
    }
  }

  const optionBreakdowns = buildOptionBreakdowns(input.players, weeklyReport, talentByPlayer);
  const advancedScoreBreakdowns = advancedOptimization.recommendations.flatMap((recommendation) =>
    recommendation.evaluation.scoreBreakdown
      ? [{ playerId: recommendation.playerId, breakdown: recommendation.evaluation.scoreBreakdown }]
      : []
  );
  const players = [...currentEntryByPlayer.values()].sort((left, right) => left.playerId - right.playerId);
  const warningSource = [
    ...players.flatMap((entry) => entry.warnings.map((warning) => ({ warning, playerId: entry.playerId }))),
    ...skillUpPredictions.flatMap((prediction) =>
      prediction.errorWeeks !== null &&
      prediction.errorWeeks >= TRAINING_CALIBRATION_HIGH_PREDICTION_ERROR_WEEKS
        ? [{ warning: "prediction_error_high" as const, playerId: prediction.playerId }]
        : []
    )
  ];

  return {
    gameWeek,
    dataset: {
      analyzedPlayers: input.datasetSelection?.analyzedPlayers ?? input.players.length,
      selectedPlayers: players.length,
      scenarios: input.datasetSelection?.scenarios ?? []
    },
    players,
    skillUpBacktest: calculateSkillUpBacktestSummary(skillUpPredictions),
    skillUpPredictions,
    recommendations: {
      continue: input.recommendations
        ? input.recommendations.filter((recommendation) => recommendation.status === "continue").length
        : recommendationObservations.filter((observation) => observation.status === "continue").length,
      switchSkill: input.recommendations
        ? input.recommendations.filter((recommendation) => recommendation.status === "switch_skill").length
        : recommendationObservations.filter((observation) => observation.status === "switch_skill").length,
      hold: input.recommendations
        ? input.recommendations.filter((recommendation) => recommendation.status === "hold").length
        : recommendationObservations.filter((observation) => observation.status === "hold").length,
      flappingDetected: flappingPlayers.length,
      observations: recommendationObservations
    },
    advancedTraining: {
      stableSlots: advancedOptimization.recommendedAdvancedPlayerIds.filter((playerId) =>
        advancedOptimization.ranking.some(
          (entry) => entry.playerId === playerId && entry.currentlyAdvanced
        )
      ).length,
      recommendedChanges: advancedOptimization.summary.recommendedChanges,
      borderlinePlayers: advancedOptimization.ranking.filter(
        (entry) =>
          entry.rank >= TRAINING_CALIBRATION_BORDERLINE_RANK_START &&
          entry.rank <= TRAINING_CALIBRATION_BORDERLINE_RANK_END
      ).length,
      rankingStability,
      cutoff: advancedOptimization.ranking
        .filter(
          (entry) =>
            entry.rank >= TRAINING_CALIBRATION_BORDERLINE_RANK_START &&
            entry.rank <= TRAINING_CALIBRATION_BORDERLINE_RANK_END
        )
        .map((entry) => ({
          playerId: entry.playerId,
          rank: entry.rank,
          score: entry.score
        }))
    },
    warnings: summarizeWarnings(warningSource),
    optionBreakdowns,
    advancedScoreBreakdowns
  };
}

function buildSkillUpBacktestPredictions(
  context: TrainingCalibrationPlayerContext
): SkillUpBacktestPrediction[] {
  const weeks = getTrainingWeeks(context.trainingHistory);
  return detectSkillUps(context.trainingHistory).map((skillUp) => {
    const previousWeek = [...weeks]
      .filter((week) => week.week < skillUp.week)
      .sort((left, right) => right.week - left.week)[0];
    if (!previousWeek) {
      return predictionWithoutEstimate(context.player.playerId, skillUp.skill, skillUp.week, 0);
    }

    const actualWeeks = skillUp.week - previousWeek.week;
    if (actualWeeks <= 0 || actualWeeks > 1 || previousWeek.skill !== skillUp.skill) {
      return predictionWithoutEstimate(
        context.player.playerId,
        skillUp.skill,
        skillUp.week,
        Math.max(0, actualWeeks)
      );
    }

    const historyAtPrediction = {
      playerId: context.trainingHistory.playerId,
      weeks: weeks.filter((week) => week.week <= previousWeek.week)
    };
    const talent = estimateTalentFromTrainingHistory(historyAtPrediction);
    const report = buildWeeklyTrainingReport({
      players: [{ history: historyAtPrediction, talent: talent.value }],
      gameWeek: previousWeek.week
    }).players[0];
    const predictedWeeks = report?.trainingPoints.estimatedWeeksToNextLevel ?? null;
    const errorWeeks = predictedWeeks === null ? null : Math.abs(predictedWeeks - actualWeeks);

    return {
      playerId: context.player.playerId,
      skill: skillUp.skill,
      predictionWeek: previousWeek.week,
      observedSkillUpWeek: skillUp.week,
      predictedWeeks,
      actualWeeks,
      errorWeeks
    };
  });
}

function predictionWithoutEstimate(
  playerId: number,
  skill: SkillTrainingCostSkill,
  observedSkillUpWeek: number,
  actualWeeks: number
): SkillUpBacktestPrediction {
  return {
    playerId,
    skill,
    predictionWeek: Math.max(0, observedSkillUpWeek - actualWeeks),
    observedSkillUpWeek,
    predictedWeeks: null,
    actualWeeks,
    errorWeeks: null
  };
}

function buildRecommendationObservations(
  context: TrainingCalibrationPlayerContext
): RecommendationCalibrationObservation[] {
  const weeks = getTrainingWeeks(context.trainingHistory)
    .filter((week) => week.kind !== "missing")
    .sort((left, right) => left.week - right.week);
  const observations: RecommendationCalibrationObservation[] = [];

  for (const currentWeek of weeks) {
    const history = {
      playerId: context.trainingHistory.playerId,
      weeks: weeks.filter((week) => week.week <= currentWeek.week)
    };
    const talent = estimateTalentFromTrainingHistory(history);
    const weeklyReport = buildWeeklyTrainingReport({
      players: [{ history, talent: talent.value }],
      gameWeek: currentWeek.week
    }).players[0];
    if (!weeklyReport) {
      continue;
    }

    const recommendationContext: PlayerTrainingRecommendationContext = {
      player: {
        ...context.player,
        age: currentWeek.playerAge,
        skills: toRecommendationSkills(currentWeek.skills)
      },
      weeklyReport,
      trainingHistory: history,
      talent
    };
    const recommendation = buildTrainingRecommendations([recommendationContext])[0];
    if (recommendation) {
      observations.push(toRecommendationObservation(recommendation, currentWeek.week));
    }
  }

  return observations;
}

function toRecommendationObservation(
  recommendation: PlayerTrainingRecommendation,
  gameWeek: number
): RecommendationCalibrationObservation {
  const currentScore = recommendation.currentOption.developmentReturnScore;
  const bestAlternativeScore = recommendation.alternatives.reduce<number | null>(
    (best, option) =>
      option.developmentReturnScore !== null && (best === null || option.developmentReturnScore > best)
        ? option.developmentReturnScore
        : best,
    null
  );
  return {
    playerId: recommendation.playerId,
    gameWeek,
    currentSkill: recommendation.currentSkill,
    status: recommendation.status,
    recommendedSkill: recommendation.recommendedSkill,
    currentScore,
    bestAlternativeScore,
    relativeImprovement:
      currentScore !== null && bestAlternativeScore !== null && currentScore > 0
        ? (bestAlternativeScore - currentScore) / currentScore
        : null,
    confidence: recommendation.confidence
  };
}

function calibrationWarnings(
  history: TrainingHistory,
  report: WeeklyTrainingPlayerReport,
  talent: TalentEstimate | undefined
): CalibrationWarning[] {
  const warnings: CalibrationWarning[] = [];
  if (history.weeks.length < 2) {
    warnings.push("insufficient_history");
  }
  if (!detectSkillUps(history).some((skillUp) => skillUp.skill === report.training.skill)) {
    warnings.push("missing_last_skill_up");
  }
  if (talent && (talent.confidence === "low" || talent.confidence === "unknown")) {
    warnings.push("unstable_talent_estimate");
  }
  if (hasInconsistentHistory(history)) {
    warnings.push("inconsistent_training_history");
  }
  return warnings;
}

function calibrationConfidence(
  history: TrainingHistory,
  report: WeeklyTrainingPlayerReport,
  talent: TalentEstimate | undefined
): "low" | "medium" | "high" {
  if (
    history.weeks.length < 2 ||
    report.trainingPoints.estimatedWeeksToNextLevel === null ||
    !talent ||
    talent.value === null ||
    talent.confidence === "unknown" ||
    talent.confidence === "low"
  ) {
    return "low";
  }
  if (history.weeks.length < 4 || talent.confidence === "medium") {
    return "medium";
  }
  return "high";
}

function hasInconsistentHistory(history: TrainingHistory): boolean {
  const weeks = getTrainingWeeks(history);
  return (
    new Set(weeks.map((week) => week.week)).size !== weeks.length ||
    weeks.some(
      (week) =>
        week.skillLevelBefore < 0 ||
        week.skillLevelAfter < 0 ||
        week.skillLevelAfter > 18 ||
        week.skillLevelBefore > 18
    )
  );
}

function buildAdvancedOptimization(
  contexts: readonly TrainingCalibrationPlayerContext[],
  weeklyReport: WeeklyTrainingReport,
  gameWeek: number
): AdvancedTrainingOptimization {
  const recommendations = buildTrainingRecommendations(
    contexts.flatMap((context) => {
      const report = weeklyReport.players.find((candidate) => candidate.playerId === context.player.playerId);
      const currentWeek = context.trainingHistory.weeks.find((week) => week.week === gameWeek);
      if (!report || !currentWeek) {
        return [];
      }
      return [{
        player: { ...context.player, age: currentWeek.playerAge, skills: toRecommendationSkills(currentWeek.skills) },
        weeklyReport: report,
        trainingHistory: context.trainingHistory,
        talent: estimateTalentFromTrainingHistory(context.trainingHistory)
      }];
    })
  );
  const recommendationByPlayer = new Map(recommendations.map((recommendation) => [recommendation.playerId, recommendation]));
  return optimizeAdvancedTrainingSlots(
    contexts.flatMap((context) => {
      const currentWeek = context.trainingHistory.weeks.find((week) => week.week === gameWeek);
      if (!currentWeek || !context.currentTraining) {
        return [];
      }
      return [{
        player: { ...context.player, age: currentWeek.playerAge, skills: toRecommendationSkills(currentWeek.skills) },
        weeklyReport: weeklyReport.players.find((report) => report.playerId === context.player.playerId),
        trainingRecommendation: recommendationByPlayer.get(context.player.playerId),
        trainingHistory: context.trainingHistory,
        currentTraining: context.currentTraining,
        talent: estimateTalentFromTrainingHistory(context.trainingHistory)
      }];
    }),
    gameWeek
  );
}

function buildOptionBreakdowns(
  contexts: readonly TrainingCalibrationPlayerContext[],
  weeklyReport: WeeklyTrainingReport,
  talentByPlayer: ReadonlyMap<number, TalentEstimate>
): TrainingOptionScoreBreakdown[] {
  return contexts.flatMap((context) => {
    const report = weeklyReport.players.find((candidate) => candidate.playerId === context.player.playerId);
    if (!report) {
      return [];
    }
    const talent = talentByPlayer.get(context.player.playerId)?.value;
    const breakdown = calculateDevelopmentReturnScoreBreakdown({
      age: context.player.age,
      talent,
      skill: report.training.skill,
      currentSkillLevel: report.skill.currentLevel,
      expectedWeeklyTrainingPoints: report.trainingPoints.earned
    });
    return breakdown ? [breakdown] : [];
  });
}

function summarizeWarnings(
  warnings: readonly { warning: CalibrationWarning; playerId: number }[]
): CalibrationWarningSummary[] {
  const grouped = new Map<CalibrationWarning, Set<number>>();
  for (const item of warnings) {
    const players = grouped.get(item.warning) ?? new Set<number>();
    players.add(item.playerId);
    grouped.set(item.warning, players);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([warning, playerIds]) => ({ warning, count: playerIds.size, playerIds: [...playerIds].sort((a, b) => a - b) }));
}

function latestGameWeek(contexts: readonly TrainingCalibrationPlayerContext[]): number {
  const weeks = contexts.flatMap((context) => getTrainingWeeks(context.trainingHistory).map((week) => week.week));
  const latest = Math.max(...weeks);
  if (!Number.isInteger(latest) || latest <= 0) {
    throw new Error("At least one training week is required for calibration.");
  }
  return latest;
}

function compareCalibrationContexts(
  left: TrainingCalibrationPlayerContext,
  right: TrainingCalibrationPlayerContext
): number {
  return (
    right.trainingHistory.weeks.length - left.trainingHistory.weeks.length ||
    left.player.age - right.player.age ||
    left.player.playerId - right.player.playerId
  );
}

function toRecommendationSkills(
  skills: Partial<Record<SkillTrainingCostSkill, number>>
): TrainingCalibrationPlayerContext["player"]["skills"] {
  return {
    ...skills,
    ...(skills.scoring !== undefined ? { striker: skills.scoring } : {})
  };
}

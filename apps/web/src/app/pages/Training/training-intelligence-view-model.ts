import type {
  AdvancedSlotReplacement,
  AdvancedTrainingPlayerRecommendation,
  AdvancedTrainingRankingEntry,
  PlayerTrainingRecommendation,
  SkillTrainingCostSkill
} from "@atlas/domain";

import type {
  TrainingPageData,
  WeeklyTrainingIntelligence,
  WeeklyTrainingReportResponse
} from "../../types";

export type TrainingAttentionPriority = "high" | "medium" | "low";
export type TrainingAttentionType =
  | "switch_skill"
  | "advanced_promotion"
  | "advanced_removal"
  | "slot_replacement"
  | "low_intensity"
  | "insufficient_data"
  | "recent_skill_up";

export interface TrainingAttentionItem {
  playerId: number;
  priority: TrainingAttentionPriority;
  type: TrainingAttentionType;
  title: string;
  description: string;
  action?: { label: string };
}

export interface TrainingIntelligenceSummaryViewModel {
  gameWeek: number;
  date: string;
  trainedPlayers: number;
  advancedPlayers: number;
  formationPlayers: number;
  skillUps: number;
  averageIntensity: number;
}

export interface AdvancedTrainingSlotRow {
  playerId: number;
  playerName: string;
  age: number | null;
  position: string;
  currentSkill: string;
  recommendedSkill: string | null;
  rank: number;
  score: number | null;
  currentlyAdvanced: boolean;
  recommendedAdvanced: boolean;
  status: string;
  confidence: string;
}

export interface AdvancedSlotReplacementViewModel {
  promotePlayerId: number;
  promotePlayerName: string;
  promoteRank: number | null;
  removePlayerId: number;
  removePlayerName: string;
  removeRank: number | null;
  scoreDifference: number;
  description: string;
}

export interface TrainingOverviewRow {
  playerId: number;
  playerName: string;
  age: number | null;
  skill: string;
  previousLevel: number | null;
  level: number;
  trainingKind: string;
  intensity: number;
  progress: number | null;
  nextSkillUp: number | null;
  skillUp: boolean;
  recommendation: string;
  confidence: string | null;
  isAdvanced: boolean;
  hasAttention: boolean;
}

export type TrainingOverviewFilter = "all" | "advanced" | "formation" | "attention" | "skill-ups";

export interface TrainingIntelligenceViewModel {
  summary: TrainingIntelligenceSummaryViewModel;
  attention: TrainingAttentionItem[];
  advancedRows: AdvancedTrainingSlotRow[];
  replacements: AdvancedSlotReplacementViewModel[];
  currentSlotCount: number;
  recommendedSlotCount: number;
  slotCount: number;
  overviewRows: TrainingOverviewRow[];
  hasInsufficientData: boolean;
}

const SKILL_LABELS: Record<SkillTrainingCostSkill, string> = {
  stamina: "Stamina",
  keeper: "Goalkeeping",
  pace: "Pace",
  scoring: "Scoring",
  defending: "Defending",
  technique: "Technique",
  playmaking: "Playmaking",
  passing: "Passing"
};

export function createTrainingIntelligenceViewModel(input: {
  training: TrainingPageData;
  intelligence: WeeklyTrainingIntelligence;
}): TrainingIntelligenceViewModel {
  const playerById = new Map(input.training.players.map((player) => [player.playerId, player]));
  const recommendationById = new Map(
    input.intelligence.recommendations.map((recommendation) => [
      recommendation.playerId,
      recommendation
    ])
  );
  const advancedRecommendationById = new Map(
    input.intelligence.advancedOptimization.recommendations.map((recommendation) => [
      recommendation.playerId,
      recommendation
    ])
  );
  const attention = createAttentionItems({
    playerById,
    report: input.intelligence.report,
    recommendations: input.intelligence.recommendations,
    advancedRecommendations: input.intelligence.advancedOptimization.recommendations,
    replacements: input.intelligence.advancedOptimization.replacements
  });
  const attentionPlayerIds = new Set(attention.map((item) => item.playerId));
  const advancedRows = input.intelligence.advancedOptimization.ranking.map((entry) =>
    createAdvancedRow({
      entry,
      playerById,
      recommendation: advancedRecommendationById.get(entry.playerId),
      trainingRecommendation: recommendationById.get(entry.playerId)
    })
  );
  const replacements = input.intelligence.advancedOptimization.replacements.map((replacement) =>
    createReplacementRow({
      replacement,
      playerById,
      ranking: input.intelligence.advancedOptimization.ranking
    })
  );
  const overviewRows = input.intelligence.report.players
    .map((playerReport) =>
      createOverviewRow({
        playerReport,
        player: playerById.get(playerReport.playerId),
        recommendation: recommendationById.get(playerReport.playerId),
        hasAttention: attentionPlayerIds.has(playerReport.playerId)
      })
    )
    .sort(compareOverviewRows);

  return {
    summary: createSummary(input.intelligence.report),
    attention,
    advancedRows,
    replacements,
    currentSlotCount: input.intelligence.advancedOptimization.summary.currentlyAdvanced,
    recommendedSlotCount:
      input.intelligence.advancedOptimization.recommendedAdvancedPlayerIds.length,
    slotCount: input.intelligence.advancedOptimization.slotCount,
    overviewRows,
    hasInsufficientData: input.intelligence.recommendations.some(
      (recommendation) => recommendation.status === "hold"
    )
  };
}

export function filterTrainingOverview(
  rows: readonly TrainingOverviewRow[],
  filter: TrainingOverviewFilter
): TrainingOverviewRow[] {
  if (filter === "all") {
    return [...rows];
  }

  return rows.filter((row) => {
    if (filter === "advanced") return row.isAdvanced;
    if (filter === "formation") return !row.isAdvanced;
    if (filter === "attention") return row.hasAttention;
    return row.skillUp;
  });
}

export function skillLabel(skill: string | null | undefined): string {
  if (!skill) return "—";
  return SKILL_LABELS[skill as SkillTrainingCostSkill] ?? skill;
}

export function recommendationLabel(
  recommendation: PlayerTrainingRecommendation | undefined
): string {
  if (!recommendation) return "—";
  if (recommendation.status === "switch_skill" && recommendation.recommendedSkill) {
    return `Switch → ${skillLabel(recommendation.recommendedSkill)}`;
  }

  return {
    continue: "Continue",
    hold: "Hold",
    switch_skill: "Switch skill"
  }[recommendation.status];
}

export function advancedRecommendationLabel(
  status: AdvancedTrainingPlayerRecommendation["status"]
): string {
  return {
    keep_advanced: "Keep advanced",
    promote_to_advanced: "Promote",
    remove_from_advanced: "Remove",
    keep_formation: "Keep formation",
    hold: "Hold"
  }[status];
}

export function describeTrainingRecommendationReasons(
  recommendation: PlayerTrainingRecommendation
): string {
  const reason = recommendation.reasons[0];
  if (!reason) return "ATLAS has no additional explanation for this recommendation.";

  switch (reason.type) {
    case "better_alternative":
      return `${skillLabel(reason.alternativeSkill)} currently offers a ${Math.round(
        reason.improvement * 100
      )} percentage points higher development return than ${skillLabel(reason.currentSkill)}.`;
    case "recent_skill_up":
      return `${skillLabel(reason.skill)} increased this week, so the next level has been recalculated.`;
    case "skill_up_soon":
      return `${skillLabel(recommendation.currentSkill)} is estimated to reach its next level in ${formatWeeks(
        reason.estimatedWeeks
      )}.`;
    case "high_next_level_cost":
      return `The next ${skillLabel(reason.skill)} level requires considerably more training.`;
    case "talent_uncertain":
      return "Talent is still uncertain; ATLAS is reducing confidence while it collects evidence.";
    case "no_valid_alternative":
      return "No valid alternative skill is currently available for comparison.";
    case "current_option_not_calculable":
      return "The current training return cannot yet be calculated reliably.";
    case "stable_current_skill":
      return `${skillLabel(reason.skill)} remains a reasonable development option for now.`;
    case "insufficient_history":
      return "ATLAS needs more training history before validating a change.";
  }
}

function createSummary(report: WeeklyTrainingReportResponse): TrainingIntelligenceSummaryViewModel {
  return {
    gameWeek: report.gameWeek,
    date: report.date,
    trainedPlayers: report.summary.trainedPlayers,
    advancedPlayers: report.summary.advancedPlayers,
    formationPlayers: report.summary.formationPlayers,
    skillUps: report.summary.skillUps,
    averageIntensity: report.summary.averageIntensity
  };
}

function createAttentionItems(input: {
  playerById: ReadonlyMap<number, TrainingPageData["players"][number]>;
  report: WeeklyTrainingReportResponse;
  recommendations: readonly PlayerTrainingRecommendation[];
  advancedRecommendations: readonly AdvancedTrainingPlayerRecommendation[];
  replacements: readonly AdvancedSlotReplacement[];
}): TrainingAttentionItem[] {
  const items: TrainingAttentionItem[] = [];

  for (const recommendation of input.recommendations) {
    const playerName =
      input.playerById.get(recommendation.playerId)?.name ?? `Player ${recommendation.playerId}`;

    if (recommendation.status === "switch_skill" && recommendation.recommendedSkill) {
      items.push({
        playerId: recommendation.playerId,
        priority: "high",
        type: "switch_skill",
        title: `Change training to ${skillLabel(recommendation.recommendedSkill)}`,
        description: `${playerName}: ${describeTrainingRecommendationReasons(recommendation)}`,
        action: { label: "Review training" }
      });
    }

    if (recommendation.status === "hold") {
      items.push({
        playerId: recommendation.playerId,
        priority: "low",
        type: "insufficient_data",
        title: "Training evidence is incomplete",
        description: `${playerName}: ${describeTrainingRecommendationReasons(recommendation)}`
      });
    }
  }

  for (const recommendation of input.advancedRecommendations) {
    if (
      recommendation.status !== "promote_to_advanced" &&
      recommendation.status !== "remove_from_advanced" &&
      recommendation.status !== "hold"
    ) {
      continue;
    }

    const playerName =
      input.playerById.get(recommendation.playerId)?.name ?? `Player ${recommendation.playerId}`;
    const isPromotion = recommendation.status === "promote_to_advanced";
    const isHold = recommendation.status === "hold";
    items.push({
      playerId: recommendation.playerId,
      priority: isHold ? "low" : "high",
      type: isHold ? "insufficient_data" : isPromotion ? "advanced_promotion" : "advanced_removal",
      title: isHold
        ? "Advanced slot decision is on hold"
        : isPromotion
          ? "Promote to advanced training"
          : "Remove from advanced training",
      description: `${playerName}: ${
        isHold
          ? "The optimizer needs more consistent evidence before changing this slot."
          : isPromotion
            ? "This player is inside the recommended advanced slots."
            : "Another candidate has a meaningfully better marginal development return."
      }`,
      action: isHold ? undefined : { label: "Review slot" }
    });
  }

  const recommendationsById = new Map(
    input.recommendations.map((recommendation) => [recommendation.playerId, recommendation])
  );
  for (const replacement of input.replacements) {
    const promoteName =
      input.playerById.get(replacement.promotePlayerId)?.name ??
      `Player ${replacement.promotePlayerId}`;
    const removeName =
      input.playerById.get(replacement.removePlayerId)?.name ??
      `Player ${replacement.removePlayerId}`;
    items.push({
      playerId: replacement.promotePlayerId,
      priority: "high",
      type: "slot_replacement",
      title: "Reassign an advanced slot",
      description: `${promoteName} should enter advanced training instead of ${removeName}. The expected development return is ${Math.round(
        replacement.scoreDifference * 100
      )} percentage points higher.`,
      action: { label: "Review slot change" }
    });
  }

  for (const playerReport of input.report.players) {
    const recommendation = recommendationsById.get(playerReport.playerId);
    if (playerReport.training.intensity === 0) {
      const playerName =
        input.playerById.get(playerReport.playerId)?.name ?? `Player ${playerReport.playerId}`;
      items.push({
        playerId: playerReport.playerId,
        priority: "medium",
        type: "low_intensity",
        title: "Training intensity is zero",
        description: `${playerName}: no weekly training points were recorded for this training cycle.`
      });
    }

    if (playerReport.skill.skillUp && recommendation?.status !== "continue") {
      items.push({
        playerId: playerReport.playerId,
        priority: "medium",
        type: "recent_skill_up",
        title: `Skill-up: ${skillLabel(playerReport.training.skill)}`,
        description: `The player moved from ${playerReport.skill.previousLevel} to ${playerReport.skill.currentLevel}. ${
          recommendation
            ? describeTrainingRecommendationReasons(recommendation)
            : "Review the next training cycle."
        }`
      });
    }
  }

  return items.sort(compareAttentionItems);
}

function createAdvancedRow(input: {
  entry: AdvancedTrainingRankingEntry;
  playerById: ReadonlyMap<number, TrainingPageData["players"][number]>;
  recommendation: AdvancedTrainingPlayerRecommendation | undefined;
  trainingRecommendation: PlayerTrainingRecommendation | undefined;
}): AdvancedTrainingSlotRow {
  const player = input.playerById.get(input.entry.playerId);
  return {
    playerId: input.entry.playerId,
    playerName: player?.name ?? `Player ${input.entry.playerId}`,
    age: player?.age ?? null,
    position: positionLabel(player?.training.position),
    currentSkill: skillLabel(input.recommendation?.evaluation.currentSkill),
    recommendedSkill: input.trainingRecommendation?.recommendedSkill
      ? skillLabel(input.trainingRecommendation.recommendedSkill)
      : null,
    rank: input.entry.rank,
    score: input.entry.score,
    currentlyAdvanced: input.entry.currentlyAdvanced,
    recommendedAdvanced: input.entry.recommendedAdvanced,
    status: input.recommendation ? advancedRecommendationLabel(input.recommendation.status) : "—",
    confidence: input.entry.confidence
  };
}

function createReplacementRow(input: {
  replacement: AdvancedSlotReplacement;
  playerById: ReadonlyMap<number, TrainingPageData["players"][number]>;
  ranking: readonly AdvancedTrainingRankingEntry[];
}): AdvancedSlotReplacementViewModel {
  const promote = input.playerById.get(input.replacement.promotePlayerId);
  const remove = input.playerById.get(input.replacement.removePlayerId);
  return {
    promotePlayerId: input.replacement.promotePlayerId,
    promotePlayerName: promote?.name ?? `Player ${input.replacement.promotePlayerId}`,
    promoteRank: rankFor(input.ranking, input.replacement.promotePlayerId),
    removePlayerId: input.replacement.removePlayerId,
    removePlayerName: remove?.name ?? `Player ${input.replacement.removePlayerId}`,
    removeRank: rankFor(input.ranking, input.replacement.removePlayerId),
    scoreDifference: input.replacement.scoreDifference,
    description: `The expected development return is ${Math.round(
      input.replacement.scoreDifference * 100
    )} percentage points higher and exceeds the optimizer's replacement threshold.`
  };
}

function createOverviewRow(input: {
  playerReport: WeeklyTrainingReportResponse["players"][number];
  player: TrainingPageData["players"][number] | undefined;
  recommendation: PlayerTrainingRecommendation | undefined;
  hasAttention: boolean;
}): TrainingOverviewRow {
  return {
    playerId: input.playerReport.playerId,
    playerName: input.player?.name ?? `Player ${input.playerReport.playerId}`,
    age: input.player?.age ?? null,
    skill: skillLabel(input.playerReport.training.skill),
    previousLevel: input.playerReport.skill.previousLevel,
    level: input.playerReport.skill.currentLevel,
    trainingKind: capitalize(input.playerReport.training.kind),
    intensity: input.playerReport.training.intensity,
    progress: input.playerReport.trainingPoints.estimatedProgress,
    nextSkillUp: input.playerReport.trainingPoints.estimatedWeeksToNextLevel,
    skillUp: input.playerReport.skill.skillUp,
    recommendation: recommendationLabel(input.recommendation),
    confidence: input.recommendation?.confidence ?? null,
    isAdvanced: input.playerReport.training.kind === "advanced",
    hasAttention: input.hasAttention
  };
}

function compareOverviewRows(left: TrainingOverviewRow, right: TrainingOverviewRow): number {
  return (
    Number(right.hasAttention) - Number(left.hasAttention) ||
    Number(right.skillUp) - Number(left.skillUp) ||
    Number(right.isAdvanced) - Number(left.isAdvanced) ||
    left.playerName.localeCompare(right.playerName)
  );
}

function compareAttentionItems(left: TrainingAttentionItem, right: TrainingAttentionItem): number {
  const priority: Record<TrainingAttentionPriority, number> = { high: 0, medium: 1, low: 2 };
  return priority[left.priority] - priority[right.priority] || left.playerId - right.playerId;
}

function positionLabel(position: number | undefined): string {
  return ["GK", "DEF", "MID", "ATT"][position ?? -1] ?? "—";
}

function rankFor(
  ranking: readonly AdvancedTrainingRankingEntry[],
  playerId: number
): number | null {
  return ranking.find((entry) => entry.playerId === playerId)?.rank ?? null;
}

function formatWeeks(weeks: number): string {
  return weeks < 1 ? "less than one week" : `${weeks.toFixed(1)} weeks`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

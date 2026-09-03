import type {
  AdvancedTrainingRecommendation,
  Confidence,
  DevelopmentProjectionWarning,
  DevelopmentProfile,
  YouthDecision,
  YouthDecisionReason,
  YouthDecisionRisk,
  YouthFitReason,
  YouthProspectStrength,
  YouthProspectWeakness
} from "@atlas/domain";
import type { YouthDecisionCandidate, YouthDecisionPlanning } from "@atlas/application";
import { formatMoney } from "../../formatters";

export type YouthDecisionFilter = "all" | YouthDecision | "high";

export interface YouthDecisionMessage {
  title: string;
  description: string;
}

export interface YouthDecisionViewModel {
  playerId: string;
  playerName: string;
  age: number | null;
  roleLabel: string;
  initialProfile: DevelopmentProfile | null;
  profileLabel: string;
  decision: YouthDecision;
  decisionLabel: string;
  priority: "high" | "medium" | "low";
  priorityLabel: string;
  sportingConfidence: Confidence;
  sportingConfidenceLabel: string;
  economicConfidence: Confidence;
  economicConfidenceLabel: string;
  prospectQualityLabel: string;
  developmentPotentialLabel: string;
  profileCoherenceLabel: string;
  clubFitLabel: string;
  squadNeedLabel: string;
  successionLabel: string;
  developmentOpportunityLabel: string;
  resourceCompetitionLabel: string;
  primaryReasons: YouthDecisionMessage[];
  risks: YouthDecisionMessage[];
  strengths: YouthDecisionMessage[];
  weaknesses: YouthDecisionMessage[];
  market: YouthMarketSummary | null;
  development: YouthDevelopmentSummary;
  advancedTraining: YouthAdvancedTrainingSummary;
  succession: YouthSuccessionSummary | null;
  resourceCompetition: YouthResourceSummary | null;
  candidate: YouthDecisionCandidate;
}

export interface YouthMarketSummary {
  currentValue: number | null;
  currentValueLabel: string;
  projectedValue: number | null;
  projectedValueLabel: string;
  trainingValuePerWeek: number | null;
  trainingValuePerWeekLabel: string;
  confidence: Confidence | null;
  comparableSales: number | null;
}

export interface YouthDevelopmentSummary {
  recommendedProfile: DevelopmentProfile | null;
  recommendedProfileLabel: string;
  targetCompletionWeeks: number | null;
  forecastConfidenceLabel: string;
  forecastStatusLabel: string;
  nextSkillUpLabel: string;
  forecastWarnings: YouthDecisionMessage[];
  advancedOpportunity: string;
  advancedRank: number | null;
  opportunityLabel: string;
  formationViable: boolean;
  changedProfile: boolean;
}

export interface YouthAdvancedTrainingSummary {
  status: AdvancedTrainingRecommendation | null;
  recommended: boolean;
  currentlyAdvanced: boolean;
  comparisonRank: number | null;
  slotCount: number | null;
  isTrial: boolean;
  profileQuality: number | null;
  profileViability: "viable" | "below_minimum" | null;
}

export interface YouthSuccessionSummary {
  outgoingCount: number;
  requiredReadyGameWeek: number | null;
  projectedReadyGameWeek: number | null;
  timingLabel: string;
}

export interface YouthResourceSummary {
  advancedRank: number | null;
  advancedOpportunity: string;
  candidates: number | null;
  futureSlots: number | null;
  competitionLabel: string;
}

const decisionLabels: Record<YouthDecision, string> = {
  train: "Train",
  keep: "Keep",
  sell: "Sell",
  release: "Release",
  hold: "Hold",
  unknown: "Unknown"
};

const confidenceLabels: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence"
};

export function createYouthDecisionViewModels(
  planning: YouthDecisionPlanning | null,
  currency: string | null
): YouthDecisionViewModel[] {
  const models = (planning?.candidates ?? []).map((candidate) =>
    createYouthDecisionViewModel(candidate, currency, planning?.advancedTraining?.slotCount ?? null)
  );
  const comparisonRanks = new Map(
    models
      .filter((model) => model.development.advancedRank !== null)
      .sort((left, right) => {
        const leftRank = left.development.advancedRank ?? Number.POSITIVE_INFINITY;
        const rightRank = right.development.advancedRank ?? Number.POSITIVE_INFINITY;
        return leftRank - rightRank || left.playerName.localeCompare(right.playerName);
      })
      .map((model, index) => [model.playerId, index + 1] as const)
  );

  return models
    .map((model) => ({
      ...model,
      advancedTraining: {
        ...model.advancedTraining,
        comparisonRank: comparisonRanks.get(model.playerId) ?? null
      }
    }))
    .sort(compareYouthDecisionViewModels);
}

export function filterYouthDecisionViewModels(
  models: readonly YouthDecisionViewModel[],
  filter: YouthDecisionFilter
): YouthDecisionViewModel[] {
  if (filter === "all") return [...models];
  if (filter === "high") return models.filter((model) => model.priority === "high");
  return models.filter((model) => model.decision === filter);
}

export function orderYouthDecisionComparisonModels(
  models: readonly YouthDecisionViewModel[]
): YouthDecisionViewModel[] {
  return [...models].sort((left, right) => {
    if (left.advancedTraining.currentlyAdvanced !== right.advancedTraining.currentlyAdvanced) {
      return left.advancedTraining.currentlyAdvanced ? -1 : 1;
    }

    const leftRank = left.advancedTraining.comparisonRank ?? Number.POSITIVE_INFINITY;
    const rightRank = right.advancedTraining.comparisonRank ?? Number.POSITIVE_INFINITY;
    return leftRank - rightRank || left.playerName.localeCompare(right.playerName);
  });
}

export function profileLabel(profile: DevelopmentProfile | null): string {
  if (profile === null) return "Profile unknown";
  const labels: Record<DevelopmentProfile, string> = {
    goalkeeper: "Goalkeeper",
    defender: "Defender",
    wing_defender: "Wing Defender",
    midfielder: "Midfielder",
    winger: "Winger",
    forward: "Forward"
  };
  return labels[profile];
}

export function mapYouthDecisionReason(reason: YouthDecisionReason): YouthDecisionMessage {
  switch (reason.type) {
    case "elite_prospect":
      return {
        title: "Excellent prospect",
        description: "Prospect quality is among the strongest evaluated."
      };
    case "strong_club_fit":
      return {
        title: "Strong club fit",
        description: "The club has a clear development path for this profile."
      };
    case "fills_future_squad_need":
      return {
        title: "Future squad need",
        description: `Covers a future ${profileLabel(reason.profile)} need.`
      };
    case "succession_candidate":
      return {
        title: "Succession candidate",
        description: "Can contribute to an identified succession path."
      };
    case "high_development_upside":
      return {
        title: "High development upside",
        description: "A meaningful amount of useful development remains."
      };
    case "high_development_value_creation":
      return {
        title: "Exceptional value creation potential",
        description: "Training is projected to create substantial market value."
      };
    case "high_training_value_efficiency":
      return {
        title: "High training value efficiency",
        description: "Training is projected to create strong value per week."
      };
    case "advanced_training_candidate":
      return {
        title: "Advanced training candidate",
        description: "The player is competitive for the advanced training pool."
      };
    case "formation_development_viable":
      return {
        title: "Formation development viable",
        description: "The development path remains viable without an advanced slot."
      };
    case "profile_overstocked":
      return {
        title: "Profile overstocked",
        description: "The current profile already has excess future depth."
      };
    case "limited_internal_opportunity":
      return {
        title: "Limited internal opportunity",
        description: "The club has limited room to prioritize this development path."
      };
    case "strong_market_value":
      return {
        title: "Strong market value",
        description: "Current market evidence gives the player material economic value."
      };
    case "high_resource_competition":
      return {
        title: "High resource competition",
        description: "Other prospects compete strongly for the same development resources."
      };
    case "better_alternative_profile":
      return {
        title: "Better alternative profile",
        description: `The ${profileLabel(reason.profile)} path offers stronger club fit.`
      };
    case "low_development_upside":
      return {
        title: "Low development upside",
        description: "Limited useful development remains in the current path."
      };
    case "low_economic_value":
      return {
        title: "Low expected economic value",
        description: "Available market evidence indicates limited economic value."
      };
    case "insufficient_evidence":
      return {
        title: "Evaluation incomplete",
        description: "ATLAS cannot evaluate this player because essential information is missing."
      };
    case "insufficient_training_snapshots":
      return {
        title: "More training snapshots required",
        description:
          "ATLAS needs at least three training observations before recommending a decision."
      };
  }
}

export function mapYouthDecisionRisk(risk: YouthDecisionRisk): YouthDecisionMessage {
  const messages: Record<YouthDecisionRisk["type"], YouthDecisionMessage> = {
    talent_uncertain: {
      title: "Talent estimate uncertain",
      description: "The recommendation may change as training evidence accumulates."
    },
    market_value_uncertain: {
      title: "Market value uncertain",
      description: "The economic estimate is based on limited evidence."
    },
    advanced_slot_unlikely: {
      title: "Advanced slot may be unavailable",
      description: "Formation training may be the initial development route."
    },
    profile_congestion: {
      title: "Profile congestion",
      description: "Several players already compete in this development pipeline."
    },
    long_development_horizon: {
      title: "Long development horizon",
      description: "The target requires a lengthy development path."
    },
    successor_timing_risk: {
      title: "Successor timing risk",
      description: "Projected readiness may not align with the expected succession window."
    },
    low_market_evidence: {
      title: "Low market evidence",
      description: "Few reliable market observations are available."
    }
  };
  return messages[risk.type];
}

export function mapYouthProspectStrength(strength: YouthProspectStrength): YouthDecisionMessage {
  switch (strength.type) {
    case "young_for_skill_level":
      return {
        title: "Young for current skill level",
        description: "Age provides additional development runway."
      };
    case "strong_primary_skill":
      return {
        title: `Strong ${skillLabel(strength.skill)}`,
        description: `Primary skill level ${strength.level}.`
      };
    case "balanced_profile":
      return {
        title: "Balanced profile",
        description: "Skills are distributed coherently for the suggested role."
      };
    case "high_development_potential":
      return {
        title: "High development upside",
        description: "The profile retains substantial useful potential."
      };
    case "clear_profile_fit":
      return {
        title: `Clear ${profileLabel(strength.profile)} profile`,
        description: "The skill distribution is well aligned with this profile."
      };
  }
}

export function mapYouthProspectWeakness(weakness: YouthProspectWeakness): YouthDecisionMessage {
  const messages: Record<YouthProspectWeakness["type"], YouthDecisionMessage> = {
    older_for_skill_level: {
      title: "Older for current skill level",
      description: "The age-adjusted development runway is more limited."
    },
    low_primary_skills: {
      title: "Low primary skills",
      description: "The core skills for the suggested profile need development."
    },
    unclear_profile: {
      title: "Profile unclear",
      description: "The current skill distribution does not strongly identify one path."
    },
    limited_development_potential: {
      title: "Limited development potential",
      description: "The useful remaining development appears constrained."
    },
    unbalanced_skill_distribution: {
      title: "Unbalanced skill distribution",
      description: "Skills are spread across competing profiles."
    }
  };
  return messages[weakness.type];
}

export function mapYouthFitReason(reason: YouthFitReason): YouthDecisionMessage {
  switch (reason.type) {
    case "profile_needed":
      return {
        title: `${profileLabel(reason.profile)} need`,
        description: `The squad needs this profile in the ${horizonLabel(reason.horizon)} horizon.`
      };
    case "succession_opportunity":
      return {
        title: "Succession opportunity",
        description: `The ${profileLabel(reason.profile)} pipeline has a succession gap.`
      };
    case "projected_ready_in_time":
      return {
        title: "Projected ready in time",
        description: "Readiness aligns with the expected squad need."
      };
    case "projected_ready_too_late":
      return {
        title: "Projected ready too late",
        description: "The current projection misses the preferred squad window."
      };
    case "current_gap_not_solved_immediately":
      return {
        title: "Does not solve the immediate gap",
        description: "The current need may require an external or senior solution first."
      };
    case "profile_overstocked":
      return {
        title: "Profile overstocked",
        description: "Future depth already exceeds the useful capacity of this profile."
      };
    case "development_congestion":
      return {
        title: "Development congestion",
        description: "The profile pipeline has more candidates than useful capacity."
      };
    case "advanced_training_likely":
      return {
        title: "Advanced training likely",
        description: "The candidate is projected inside the advanced training pool."
      };
    case "advanced_training_unlikely":
      return {
        title: "Advanced training unlikely",
        description: "The player can still develop through formation training."
      };
    case "formation_training_viable":
      return {
        title: "Formation training viable",
        description: "A non-advanced development route remains reasonable."
      };
    case "strong_internal_competition":
      return {
        title: "Strong internal competition",
        description: "Other developing players compete for the same future roles."
      };
    case "reprofile_opportunity":
      return {
        title: "Reprofile opportunity",
        description: `A compatible ${profileLabel(reason.profile)} path improves club fit.`
      };
    case "missing_squad_context":
      return {
        title: "Squad context missing",
        description: "ATLAS cannot fully evaluate club fit yet."
      };
    case "missing_development_projection":
      return {
        title: "Development projection missing",
        description: "Readiness and development timing remain uncertain."
      };
    case "incomplete_development_path":
      return {
        title: "Development path incomplete",
        description: "The club path is not fully modeled yet."
      };
  }
}

function projectionStatusLabel(
  status: "projected" | "partial" | "unavailable" | undefined
): string {
  if (status === "projected") return "Complete";
  if (status === "partial") return "Partial";
  if (status === "unavailable") return "Unavailable";
  return "Unknown";
}

function projectionNextSkillUpLabel(
  projection: YouthDecisionCandidate["developmentProjection"]
): string {
  const step = projection?.steps[0];
  if (!step || step.estimatedWeeks === null) return "Unknown";
  return `${capitalize(step.skill)} ${step.toLevel} · ~${Math.round(step.estimatedWeeks)} weeks`;
}

export function mapDevelopmentProjectionWarning(
  warning: DevelopmentProjectionWarning
): YouthDecisionMessage {
  switch (warning) {
    case "unknown_current_sublevel":
      return {
        title: "Current sublevel unknown",
        description: "The next skill-up starts from an unobserved partial level."
      };
    case "low_talent_confidence":
      return {
        title: "Talent estimate uncertain",
        description: "Training speed has limited supporting evidence."
      };
    case "long_term_projection":
      return {
        title: "Long-term target",
        description: "Part of the plan extends beyond two Sokker seasons."
      };
    case "advanced_training_assumed":
      return {
        title: "Advanced training assumed",
        description: "The forecast assumes the player keeps advanced training."
      };
    case "formation_training_assumed":
      return {
        title: "Formation training assumed",
        description: "The forecast assumes the player keeps formation training."
      };
    case "intensity_assumed":
      return {
        title: "Training intensity assumed",
        description: "Future weeks use the latest observed intensity."
      };
    case "projection_horizon_exceeded":
      return {
        title: "Target exceeds projection horizon",
        description: "The complete target is not viable within the modeled career horizon."
      };
    case "invalid_training_points":
      return {
        title: "Training points unavailable",
        description: "The forecast cannot calculate valid weekly training points."
      };
    case "path_incomplete":
      return {
        title: "Development path incomplete",
        description: "The complete target could not be scheduled."
      };
    case "continuous_training_not_assumed":
      return {
        title: "Continuous training not assumed",
        description: "The forecast includes possible training interruptions."
      };
  }
}
export function createYouthDecisionViewModel(
  candidate: YouthDecisionCandidate,
  currency: string | null,
  advancedTrainingSlotCount: number | null = null
): YouthDecisionViewModel {
  const recommendation = candidate.recommendation;
  const advanced = candidate.opportunity.advancedTraining;
  const advancedTrainingRecommendation = candidate.advancedTrainingRecommendation ?? null;
  const succession = candidate.opportunity.succession;
  const capacity = candidate.opportunity.developmentCapacity;
  const completionWeeks =
    candidate.marketProjection?.completion?.estimatedWeeks ??
    candidate.developmentProjection?.completion.estimatedWeeks ??
    null;
  const developmentProfile = recommendation.recommendedProfile ?? candidate.initialProfile;

  return {
    playerId: String(candidate.playerId),
    playerName: candidate.playerName,
    age: candidate.age,
    roleLabel: roleLabel(candidate.role),
    initialProfile: candidate.initialProfile,
    profileLabel: profileLabel(developmentProfile),
    decision: recommendation.decision,
    decisionLabel: decisionLabels[recommendation.decision],
    priority: recommendation.priority,
    priorityLabel: `${capitalize(recommendation.priority)} priority`,
    sportingConfidence: recommendation.sportingConfidence,
    sportingConfidenceLabel: confidenceLabels[recommendation.sportingConfidence],
    economicConfidence: recommendation.economicConfidence,
    economicConfidenceLabel: confidenceLabels[recommendation.economicConfidence],
    prospectQualityLabel: qualityLabel(recommendation.scores.prospectQuality),
    developmentPotentialLabel: qualityLabel(candidate.prospect.developmentPotentialScore),
    profileCoherenceLabel: qualityLabel(candidate.prospect.profileCoherenceScore),
    clubFitLabel: fitLabel(recommendation.scores.clubFit),
    squadNeedLabel: fitLabel(candidate.opportunity.squadNeedScore),
    successionLabel:
      succession?.score === null || succession?.score === undefined
        ? "Unknown"
        : fitLabel(succession.score),
    developmentOpportunityLabel: fitLabel(recommendation.scores.developmentOpportunity),
    resourceCompetitionLabel: competitionLabel(candidate.opportunity.resourceCompetitionScore),
    primaryReasons: recommendation.reasons.map(mapYouthDecisionReason),
    risks: recommendation.risks.map(mapYouthDecisionRisk),
    strengths: candidate.prospect.strengths.map(mapYouthProspectStrength),
    weaknesses: candidate.prospect.weaknesses.map(mapYouthProspectWeakness),
    market: createMarketSummary(candidate, currency),
    development: {
      recommendedProfile: developmentProfile,
      recommendedProfileLabel: profileLabel(developmentProfile),
      targetCompletionWeeks: completionWeeks,
      forecastConfidenceLabel: candidate.developmentProjection
        ? confidenceLabels[candidate.developmentProjection.confidence]
        : "Unknown",
      forecastStatusLabel: projectionStatusLabel(candidate.developmentProjection?.projectionStatus),
      nextSkillUpLabel: projectionNextSkillUpLabel(candidate.developmentProjection),
      forecastWarnings: (candidate.developmentProjection?.warnings ?? []).map(
        mapDevelopmentProjectionWarning
      ),
      advancedOpportunity: advanced?.opportunity ?? "unknown",
      advancedRank: advanced?.projectedRank ?? null,
      opportunityLabel: fitLabel(recommendation.scores.developmentOpportunity),
      formationViable: candidate.opportunity.reasons.some(
        (reason) => reason.type === "formation_training_viable"
      ),
      changedProfile:
        recommendation.recommendedProfile !== null &&
        recommendation.recommendedProfile !== candidate.initialProfile
    },
    advancedTraining: {
      status: advancedTrainingRecommendation?.status ?? null,
      recommended:
        advancedTrainingRecommendation?.recommendedAdvanced ??
        (advanced?.projectedRank !== null &&
          advanced?.projectedRank !== undefined &&
          advanced.projectedRank <= (advancedTrainingSlotCount ?? 10)),
      currentlyAdvanced: candidate.currentlyAdvanced,
      comparisonRank: null,
      slotCount: advancedTrainingSlotCount,
      isTrial: advancedTrainingRecommendation?.status === "trial_advanced",
      profileQuality: advancedTrainingRecommendation?.evaluation.trialProfileQuality ?? null,
      profileViability: advancedTrainingRecommendation?.reasons.some(
        (reason) => reason.type === "trial_profile_not_viable"
      )
        ? "below_minimum"
        : advancedTrainingRecommendation?.reasons.some(
              (reason) => reason.type === "trial_profile_viable"
            )
          ? "viable"
          : null
    },
    succession: succession
      ? {
          outgoingCount: succession.outgoingPlayerIds.length,
          requiredReadyGameWeek: succession.requiredReadyGameWeek,
          projectedReadyGameWeek: succession.projectedReadyGameWeek,
          timingLabel: timingLabel(succession.timingGapWeeks)
        }
      : null,
    resourceCompetition:
      capacity || advanced
        ? {
            advancedRank: advanced?.projectedRank ?? null,
            advancedOpportunity: advanced?.opportunity ?? "unknown",
            candidates: capacity ? capacity.currentDevelopingPlayers + capacity.prospects : null,
            futureSlots: capacity?.projectedFutureSlots ?? null,
            competitionLabel: competitionLabel(candidate.opportunity.resourceCompetitionScore)
          }
        : null,
    candidate
  };
}

function createMarketSummary(
  candidate: YouthDecisionCandidate,
  currency: string | null
): YouthMarketSummary | null {
  if (!candidate.marketValue && !candidate.marketProjection) return null;
  return {
    currentValue:
      candidate.marketValue?.calibratedValue.expected ??
      candidate.marketProjection?.current.calibratedValue.expected ??
      null,
    currentValueLabel: formatMarketValue(
      candidate.marketValue?.calibratedValue.expected ??
        candidate.marketProjection?.current.calibratedValue.expected ??
        null,
      currency
    ),
    projectedValue:
      candidate.marketProjection?.completion?.marketValue?.expected ??
      candidate.marketProjection?.peak?.value ??
      null,
    projectedValueLabel: formatMarketValue(
      candidate.marketProjection?.completion?.marketValue?.expected ??
        candidate.marketProjection?.peak?.value ??
        null,
      currency
    ),
    trainingValuePerWeek: candidate.marketProjection?.roi.averageValueGainPerWeek ?? null,
    trainingValuePerWeekLabel: formatMarketValue(
      candidate.marketProjection?.roi.averageValueGainPerWeek ?? null,
      currency,
      true
    ),
    confidence: candidate.marketValue?.confidence ?? candidate.marketProjection?.confidence ?? null,
    comparableSales: candidate.marketValue?.comparableEstimate?.sampleSize ?? null
  };
}

function compareYouthDecisionViewModels(
  left: YouthDecisionViewModel,
  right: YouthDecisionViewModel
): number {
  const priority = { high: 3, medium: 2, low: 1 };
  const action = { hold: 6, unknown: 5, train: 4, sell: 3, release: 2, keep: 1 };
  const confidence = { high: 3, medium: 2, low: 1 };
  return (
    priority[right.priority] - priority[left.priority] ||
    action[right.decision] - action[left.decision] ||
    confidence[right.sportingConfidence] - confidence[left.sportingConfidence] ||
    left.playerName.localeCompare(right.playerName) ||
    left.playerId.localeCompare(right.playerId)
  );
}

function qualityLabel(value: number | null): string {
  if (value === null) return "Unknown";
  if (value >= 0.8) return "Very High";
  if (value >= 0.68) return "High";
  if (value >= 0.5) return "Medium";
  if (value >= 0.35) return "Low";
  return "Very Low";
}

function fitLabel(value: number | null): string {
  if (value === null) return "Unknown";
  if (value >= 0.78) return "Excellent";
  if (value >= 0.58) return "Good";
  if (value >= 0.35) return "Limited";
  return "Poor";
}

function competitionLabel(value: number | null): string {
  if (value === null) return "Unknown";
  if (value >= 0.65) return "High";
  if (value >= 0.35) return "Medium";
  return "Low";
}

function timingLabel(gap: number | null): string {
  if (gap === null) return "Unknown timing";
  if (gap <= 0) return "Good timing";
  if (gap <= 8) return "Slightly late";
  return "Late timing";
}

function horizonLabel(horizon: "current" | "next_season" | "medium_term"): string {
  return horizon === "current"
    ? "current"
    : horizon === "next_season"
      ? "next-season"
      : "medium-term";
}

function roleLabel(role: string): string {
  return role === "core"
    ? "Core"
    : role === "developing"
      ? "Developing"
      : role === "prospect"
        ? "Prospect"
        : role === "rotation"
          ? "Rotation"
          : role === "depth"
            ? "Depth"
            : "Transition";
}

function skillLabel(skill: string): string {
  const labels: Record<string, string> = {
    stamina: "Stamina",
    pace: "Pace",
    technique: "Technique",
    passing: "Passing",
    keeper: "Keeping",
    defender: "Defending",
    playmaker: "Playmaking",
    striker: "Scoring"
  };
  return labels[skill] ?? skill;
}

function formatMarketValue(value: number | null, currency: string | null, signed = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${formatMoney({ amount: Math.round(value), currency, isComplete: true })}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

import {
  DEVELOPMENT_PRIORITY_WEIGHTS,
  DEVELOPMENT_PROFILES,
  suggestDevelopmentProfile,
  type DevelopmentProfile,
  type DevelopmentPlayer,
  type PlayerDevelopmentPlan
} from "../playerDevelopment/index.js";
import type { Confidence, SkillKey, SkillSet } from "../types.js";
import type { TalentEstimate } from "../training/types.js";
import { PLAYER_MARKET_VALUE_CONFIG } from "./constants.js";
import type {
  MarketValueCalibrationSample,
  MarketValueRange,
  PlayerMarketValueConfig,
  PlayerMarketValueContext,
  PlayerMarketValueEstimate,
  PlayerMarketValuePlayerInput,
  PlayerMarketValueReason,
  SquadMarketValueAssessment,
  SquadMarketValueRankingEntry
} from "./types.js";

export * from "./constants.js";
export * from "./types.js";
export * from "./calibration-constants.js";
export * from "./calibration-types.js";
export * from "./comparables.js";
export * from "./calibration.js";

const VALID_MINIMUM_AGE = 15;
const VALID_MAXIMUM_AGE = 45;
const VALID_MINIMUM_SKILL = 0;
const VALID_MAXIMUM_SKILL = 20;

export function calculateSkillValue(
  player: PlayerMarketValuePlayerInput,
  profile?: DevelopmentProfile | null,
  config: PlayerMarketValueConfig = PLAYER_MARKET_VALUE_CONFIG
): number {
  const resolvedProfile = profile ?? resolveProfileForPlayer(player).profile;
  const definition = DEVELOPMENT_PROFILES[resolvedProfile];
  const totalWeight = definition.relevantSkills.reduce(
    (total, item) => total + DEVELOPMENT_PRIORITY_WEIGHTS[item.priority],
    0
  );
  const weightedCurve = definition.relevantSkills.reduce((total, item) => {
    const level = readSkill(player.skills, item.skill);
    const weight = DEVELOPMENT_PRIORITY_WEIGHTS[item.priority];
    return total + calculateMarketSkillCurve(level ?? 0, config) * weight;
  }, 0);
  const referenceCurve = calculateMarketSkillCurve(config.referenceSkillLevel, config);

  return roundMoney(
    config.baseValue * (weightedCurve / (totalWeight * Math.max(referenceCurve, 1)))
  );
}

export function calculateMarketAgeFactor(
  age: number,
  config: PlayerMarketValueConfig = PLAYER_MARKET_VALUE_CONFIG
): number {
  assertValidAge(age);
  return clamp(
    Math.exp((config.youngAgeReference - age) * config.ageCurveSlope),
    config.minimumAgeFactor,
    config.maximumAgeFactor
  );
}

export function estimatePlayerMarketValue(
  context: PlayerMarketValueContext,
  config: PlayerMarketValueConfig = PLAYER_MARKET_VALUE_CONFIG
): PlayerMarketValueEstimate {
  const player = context.player;
  const profileResolution = resolveProfile(context);
  const profile = profileResolution.profile;
  const reasons: PlayerMarketValueReason[] = [];
  const hasValidAge = isValidAge(player.age);
  const knownRelevantSkills = DEVELOPMENT_PROFILES[profile].relevantSkills.filter(
    ({ skill }) => readSkill(player.skills, skill) !== null
  );

  if (profileResolution.usedFallback) {
    reasons.push({ type: "profile_fallback_used", profile });
  }
  if (
    !hasValidAge ||
    knownRelevantSkills.length < DEVELOPMENT_PROFILES[profile].relevantSkills.length
  ) {
    reasons.push({ type: "incomplete_data" });
  }

  const skillValue = calculateSkillValue(player, profile, config);
  const ageFactor = hasValidAge ? calculateMarketAgeFactor(player.age!, config) : 1;
  const ageAdjustment = roundMoney(skillValue * (ageFactor - 1));
  const skillDistributionAdjustment = calculateDistributionAdjustment(
    player.skills,
    profile,
    skillValue,
    config
  );
  // V1 keeps profile scarcity neutral. The profile affects skill interpretation only;
  // future comparable sales can calibrate this component without changing the contract.
  const profileAdjustment = 0;
  const developmentAdjustment = calculateDevelopmentAdjustment(
    player,
    context.developmentPlan ?? null,
    context.talent ?? null,
    skillValue,
    config,
    reasons
  );
  const rawValue = sumMoneyValues(
    skillValue,
    ageAdjustment,
    profileAdjustment,
    skillDistributionAdjustment,
    developmentAdjustment
  );
  const finalValue = Math.max(0, rawValue);

  addSkillReasons(player.skills, profile, reasons);
  if (ageFactor > 1.04) reasons.push({ type: "young_age_premium" });
  if (ageFactor < 0.96) reasons.push({ type: "age_discount" });
  if (isStrongDistribution(player.skills, profile)) {
    reasons.push({ type: "strong_skill_distribution" });
  }
  if (context.talent && context.talent.confidence === "low") {
    reasons.push({ type: "talent_low_confidence" });
  }

  const confidence = calculateConfidence({
    profile,
    usedFallback: profileResolution.usedFallback,
    hasValidAge,
    knownRelevantSkillCount: knownRelevantSkills.length
  });
  const estimatedValue = createMarketValueRange(finalValue, confidence, config);
  const sokkerValue = readSokkerValue(player);

  return {
    playerId: player.playerId,
    estimatedValue,
    estimatedMarketValue: estimatedValue,
    sokkerValue,
    marketToSokkerRatio:
      sokkerValue !== null && sokkerValue > 0 ? estimatedValue.expected / sokkerValue : null,
    confidence,
    breakdown: {
      skillValue,
      ageAdjustment,
      profileAdjustment,
      skillDistributionAdjustment,
      developmentAdjustment,
      rawValue,
      finalValue
    },
    reasons
  };
}

export function estimateSquadMarketValues(
  contexts: readonly PlayerMarketValueContext[],
  config: PlayerMarketValueConfig = PLAYER_MARKET_VALUE_CONFIG
): SquadMarketValueAssessment {
  const players = contexts
    .map((context) => estimatePlayerMarketValue(context, config))
    .sort((left, right) => left.playerId - right.playerId);
  const ranking = [...players]
    .sort(
      (left, right) =>
        right.estimatedValue.expected - left.estimatedValue.expected ||
        left.playerId - right.playerId
    )
    .map((player, index): SquadMarketValueRankingEntry => ({
      playerId: player.playerId,
      expectedValue: player.estimatedValue.expected,
      rank: index + 1
    }));
  const expectedValues = players.map((player) => player.estimatedValue.expected);
  const totalEstimatedValue = sumMoneyValues(...expectedValues);
  const averageEstimatedValue = expectedValues.length
    ? roundMoney(totalEstimatedValue / expectedValues.length)
    : 0;
  const medianEstimatedValue = calculateMedian(expectedValues);
  const topValue = ranking[0]?.expectedValue;

  return {
    players,
    ranking,
    totalEstimatedValue,
    averageEstimatedValue,
    medianEstimatedValue,
    mostValuablePlayerIds:
      topValue === undefined
        ? []
        : ranking.filter((entry) => entry.expectedValue === topValue).map((entry) => entry.playerId)
  };
}

export function createMarketValueCalibrationSample(
  context: PlayerMarketValueContext,
  estimate: PlayerMarketValueEstimate = estimatePlayerMarketValue(context)
): MarketValueCalibrationSample {
  const profile = resolveProfile(context).profile;
  const primarySkills = Object.fromEntries(
    DEVELOPMENT_PROFILES[profile].relevantSkills
      .filter((item) => item.priority === "primary")
      .map((item) => {
        const level = readSkill(context.player.skills, item.skill);
        return level === null ? null : [item.skill, level];
      })
      .filter((entry): entry is [SkillKey, number] => entry !== null)
  ) as Partial<Record<SkillKey, number>>;

  return {
    playerId: context.player.playerId,
    estimatedMarketValue: estimate.estimatedValue.expected,
    sokkerValue: estimate.sokkerValue,
    ratio: estimate.marketToSokkerRatio,
    age: isValidAge(context.player.age) ? context.player.age : null,
    profile,
    primarySkills
  };
}

export class PlayerMarketValuationService {
  constructor(private readonly config: PlayerMarketValueConfig = PLAYER_MARKET_VALUE_CONFIG) {}

  estimatePlayerMarketValue(context: PlayerMarketValueContext): PlayerMarketValueEstimate {
    return estimatePlayerMarketValue(context, this.config);
  }

  estimateSquadMarketValues(
    contexts: readonly PlayerMarketValueContext[]
  ): SquadMarketValueAssessment {
    return estimateSquadMarketValues(contexts, this.config);
  }

  createCalibrationSample(
    context: PlayerMarketValueContext,
    estimate?: PlayerMarketValueEstimate
  ): MarketValueCalibrationSample {
    return createMarketValueCalibrationSample(
      context,
      estimate ?? this.estimatePlayerMarketValue(context)
    );
  }
}

function resolveProfile(context: PlayerMarketValueContext): {
  profile: DevelopmentProfile;
  usedFallback: boolean;
} {
  const explicitProfile =
    context.developmentProfile ??
    context.developmentPlan?.target.profile ??
    context.squadAssessment?.profile ??
    context.player.profile ??
    null;
  if (explicitProfile) return { profile: explicitProfile, usedFallback: false };

  return { ...resolveProfileForPlayer(context.player), usedFallback: true };
}

function resolveProfileForPlayer(player: PlayerMarketValuePlayerInput): {
  profile: DevelopmentProfile;
} {
  const developmentPlayer: DevelopmentPlayer = {
    playerId: player.playerId,
    skills: player.skills,
    age: player.age,
    formation: player.formation ?? formationFromTrainingPosition(player.training?.position),
    position: player.position,
    observedPosition: player.observedPosition
  };
  return { profile: suggestDevelopmentProfile(developmentPlayer).profile };
}

function formationFromTrainingPosition(
  position: number | undefined
): "GK" | "DEF" | "MID" | "ATT" | null {
  if (position === undefined) return null;
  if (position === 0) return "GK";
  if (position === 1) return "DEF";
  if (position === 3) return "ATT";
  return "MID";
}

function calculateDistributionAdjustment(
  skills: SkillSet,
  profile: DevelopmentProfile,
  skillValue: number,
  config: PlayerMarketValueConfig
): number {
  const relevant = DEVELOPMENT_PROFILES[profile].relevantSkills
    .map(({ skill }) => readSkill(skills, skill))
    .filter((level): level is number => level !== null);
  if (relevant.length === 0 || skillValue <= 0) return 0;

  const coverage = relevant.length / DEVELOPMENT_PROFILES[profile].relevantSkills.length;
  const usefulCoverage = relevant.filter((level) => level >= 8).length / relevant.length;
  const balance = 1 - standardDeviation(relevant) / VALID_MAXIMUM_SKILL;
  const quality = clamp(coverage * 0.35 + usefulCoverage * 0.4 + balance * 0.25, 0, 1);

  return roundMoney(skillValue * config.maximumDistributionPremium * quality);
}

function calculateDevelopmentAdjustment(
  player: PlayerMarketValuePlayerInput,
  plan: PlayerDevelopmentPlan | null,
  talent: TalentEstimate | null,
  skillValue: number,
  config: PlayerMarketValueConfig,
  reasons: PlayerMarketValueReason[]
): number {
  if (!plan || skillValue <= 0) return 0;

  const targetSkills = plan.target.targetSkills;
  const totalTargetWeight = targetSkills.reduce(
    (total, item) =>
      total + DEVELOPMENT_PRIORITY_WEIGHTS[item.priority] * Math.max(item.targetLevel, 0),
    0
  );
  const remainingWeight = targetSkills.reduce((total, item) => {
    const current = readSkill(player.skills, item.skill) ?? 0;
    return (
      total + DEVELOPMENT_PRIORITY_WEIGHTS[item.priority] * Math.max(item.targetLevel - current, 0)
    );
  }, 0);
  const upside = totalTargetWeight > 0 ? clamp(remainingWeight / totalTargetWeight, 0, 1) : 0;
  if (upside <= 0.01) {
    reasons.push({ type: "limited_development_upside" });
    return 0;
  }

  const talentSignal = talentSignalForMarket(talent);
  const developmentPremium = clamp(
    upside * (0.02 + talentSignal * 0.08),
    0,
    config.maximumDevelopmentPremium
  );
  if (developmentPremium >= 0.035) reasons.push({ type: "high_development_upside" });
  else reasons.push({ type: "limited_development_upside" });
  return roundMoney(skillValue * developmentPremium);
}

function calculateConfidence(input: {
  profile: DevelopmentProfile;
  usedFallback: boolean;
  hasValidAge: boolean;
  knownRelevantSkillCount: number;
}): Confidence {
  const relevantSkillCount = DEVELOPMENT_PROFILES[input.profile].relevantSkills.length;
  if (
    input.usedFallback ||
    !input.hasValidAge ||
    input.knownRelevantSkillCount < Math.max(2, relevantSkillCount - 1)
  ) {
    return "low";
  }
  // No comparable sales exist in V1, so even complete observable data is medium at most.
  return "medium";
}

function createMarketValueRange(
  expected: number,
  confidence: Confidence,
  config: PlayerMarketValueConfig
): MarketValueRange {
  const spread = config.rangeSpreadByConfidence[confidence];
  return {
    low: Math.max(0, roundMoney(expected * (1 - spread))),
    expected,
    high: Math.max(expected, roundMoney(expected * (1 + spread)))
  };
}

function addSkillReasons(
  skills: SkillSet,
  profile: DevelopmentProfile,
  reasons: PlayerMarketValueReason[]
): void {
  for (const item of DEVELOPMENT_PROFILES[profile].relevantSkills) {
    const level = readSkill(skills, item.skill);
    if (item.priority === "primary" && level !== null && level >= 13) {
      reasons.push({ type: "elite_primary_skill", skill: item.skill, level });
    }
  }
}

function isStrongDistribution(skills: SkillSet, profile: DevelopmentProfile): boolean {
  const levels = DEVELOPMENT_PROFILES[profile].relevantSkills
    .map(({ skill }) => readSkill(skills, skill))
    .filter((level): level is number => level !== null);
  return levels.length >= 3 && levels.filter((level) => level >= 8).length >= 3;
}

function talentSignalForMarket(talent: TalentEstimate | null): number {
  if (!talent || talent.value === null || !Number.isFinite(talent.value)) return 0;
  const confidenceWeight =
    talent.confidence === "high"
      ? 1
      : talent.confidence === "medium"
        ? 0.65
        : talent.confidence === "low"
          ? 0.2
          : 0;
  return clamp(((talent.value - 0.85) / 0.4) * confidenceWeight, 0, 1);
}

function readSkill(skills: SkillSet, skill: SkillKey): number | null {
  const level = skills[skill];
  if (typeof level !== "number" || !Number.isFinite(level)) return null;
  return clamp(level, VALID_MINIMUM_SKILL, VALID_MAXIMUM_SKILL);
}

function readSokkerValue(player: PlayerMarketValuePlayerInput): number | null {
  const value =
    player.sokkerValue ??
    (typeof player.value === "number" ? player.value : player.value?.amount) ??
    null;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function calculateMarketSkillCurve(
  level: number,
  config: PlayerMarketValueConfig = PLAYER_MARKET_VALUE_CONFIG
): number {
  return Math.pow(clamp(level, VALID_MINIMUM_SKILL, VALID_MAXIMUM_SKILL), config.skillExponent);
}

function calculateMedian(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? roundMoney((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

function standardDeviation(values: readonly number[]): number {
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  return Math.sqrt(
    values.reduce((total, value) => total + Math.pow(value - average, 2), 0) / values.length
  );
}

function sumMoneyValues(...values: readonly number[]): number {
  const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  return roundMoney(total);
}

function roundMoney(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function isValidAge(age: number | null): age is number {
  return (
    typeof age === "number" &&
    Number.isFinite(age) &&
    age >= VALID_MINIMUM_AGE &&
    age <= VALID_MAXIMUM_AGE
  );
}

function assertValidAge(age: number): void {
  if (!isValidAge(age)) {
    throw new RangeError(
      `Market value age must be between ${VALID_MINIMUM_AGE} and ${VALID_MAXIMUM_AGE}`
    );
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

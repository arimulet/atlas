import {
  calculateMarketSkillCurve,
  estimatePlayerMarketValue,
  type PlayerMarketValueConfig
} from "./index.js";
import {
  DEVELOPMENT_PRIORITY_WEIGHTS,
  DEVELOPMENT_PROFILES,
  suggestDevelopmentProfile
} from "../playerDevelopment/index.js";
import type {
  DevelopmentProfile,
  DevelopmentPlayer,
  Formation
} from "../playerDevelopment/index.js";
import type { SkillKey, SkillSet } from "../types.js";
import { MARKET_CALIBRATION_CONFIG } from "./calibration-constants.js";
import type {
  ComparableDifference,
  ComparableMarketOutlier,
  ComparableMarketEstimate,
  FindMarketComparablesOptions,
  MarketCalibrationConfig,
  MarketComparable,
  MarketComparableTarget,
  PlayerTransferRecord,
  TransferDataQuality
} from "./calibration-types.js";
import type {
  MarketValueRange,
  PlayerMarketValueContext,
  PlayerMarketValuePlayerInput
} from "./types.js";

const VALID_MINIMUM_AGE = 15;
const VALID_MAXIMUM_AGE = 45;
const VALID_MAXIMUM_SKILL = 20;

export function calculatePlayerMarketSimilarity(
  target: MarketComparableTarget,
  comparable: PlayerTransferRecord,
  config: MarketCalibrationConfig = MARKET_CALIBRATION_CONFIG
): number {
  void config;
  const targetPlayer = readPlayer(target);
  const targetProfile = resolveProfile(targetPlayer, readContextProfile(target));
  const comparableProfile = resolveTransferProfile(comparable);
  const skillSimilarity = calculateSkillSimilarity(
    targetPlayer.skills,
    comparable.skills,
    targetProfile
  );
  const ageSimilarity = calculateComparableAgeSimilarity(targetPlayer.age ?? 0, comparable.age);
  const profileSimilarity = calculateProfileSimilarity(
    targetProfile,
    comparableProfile,
    targetPlayer,
    comparable
  );
  const availableComponents = [skillSimilarity, ageSimilarity, profileSimilarity].filter(
    (component): component is number => component !== null
  );
  if (availableComponents.length === 0) return 0;

  const weightedScore =
    (skillSimilarity ?? 0) * 0.6 + ageSimilarity * 0.2 + profileSimilarity * 0.2;
  const availableWeight =
    (skillSimilarity === null ? 0 : 0.6) + 0.2 + (profileSimilarity === null ? 0 : 0.2);
  return clamp(weightedScore / Math.max(availableWeight, 0.01), 0, 1);
}

export function calculateComparableAgeSimilarity(targetAge: number, comparableAge: number): number {
  if (!isValidAge(targetAge) || !isValidAge(comparableAge)) return 0;
  return clamp(Math.exp(-Math.abs(targetAge - comparableAge) * 0.18), 0, 1);
}

export function calculateTransferRecencyWeight(
  transferDate: Date,
  asOfDate: Date,
  config: MarketCalibrationConfig = MARKET_CALIBRATION_CONFIG
): number {
  const ageInDays = Math.max(0, (asOfDate.getTime() - transferDate.getTime()) / 86_400_000);
  if (!Number.isFinite(ageInDays)) return 0;
  return clamp(Math.exp((-Math.log(2) * ageInDays) / config.recencyHalfLifeDays), 0, 1);
}

export function findMarketComparables(
  target: MarketComparableTarget,
  transfers: readonly PlayerTransferRecord[],
  options: FindMarketComparablesOptions = {}
): MarketComparable[] {
  const config = resolveCalibrationConfig(options);
  const targetPlayer = readPlayer(target);
  const asOfDate =
    options.asOfDate ?? options.beforeDateExclusive ?? latestTransferDate(transfers) ?? new Date(0);
  const beforeDate = options.beforeDateExclusive;
  const uniqueTransfers = deduplicateTransferRecords(transfers);

  return uniqueTransfers
    .filter((transfer) => isUsableTransferDate(transfer.transferDate))
    .filter((transfer) => {
      if (beforeDate && transfer.transferDate.getTime() >= beforeDate.getTime()) return false;
      if (!beforeDate && transfer.transferDate.getTime() > asOfDate.getTime()) return false;
      if (options.excludeTransferId && transfer.transferId === options.excludeTransferId)
        return false;
      if (
        options.excludePlayerId !== undefined &&
        transfer.playerId !== undefined &&
        transfer.playerId === options.excludePlayerId
      ) {
        return false;
      }
      return true;
    })
    .map((transfer): MarketComparable | null => {
      const normalizedSalePrice = normalizeSalePrice(transfer, options, config);
      if (normalizedSalePrice === null || normalizedSalePrice <= 0) return null;
      const similarityScore = calculatePlayerMarketSimilarity(target, transfer, config);
      if (similarityScore < config.minimumSimilarity) return null;
      const recencyWeight = calculateTransferRecencyWeight(transfer.transferDate, asOfDate, config);
      const dataQualityWeight = calculateTransferDataQualityWeight(
        assessTransferDataQuality(transfer, targetPlayer),
        config
      );
      const adjustedSimilarityScore = similarityScore * recencyWeight * dataQualityWeight;

      return {
        transfer,
        similarityScore,
        recencyWeight,
        dataQualityWeight,
        adjustedSimilarityScore,
        normalizedSalePrice,
        adjustedSalePrice: normalizedSalePrice,
        differences: calculateComparableDifferences(target, transfer)
      };
    })
    .filter((comparable): comparable is MarketComparable => comparable !== null)
    .sort(compareComparables)
    .slice(0, options.maxComparables ?? config.maxComparables);
}

export function adjustComparablePrice(
  target: MarketComparableTarget,
  comparable: MarketComparable | PlayerTransferRecord,
  config: MarketCalibrationConfig = MARKET_CALIBRATION_CONFIG,
  fundamentalConfig?: PlayerMarketValueConfig
): number {
  const transfer = "transfer" in comparable ? comparable.transfer : comparable;
  const normalizedPrice =
    "transfer" in comparable
      ? comparable.normalizedSalePrice
      : normalizeSalePrice(transfer, {}, config);
  if (normalizedPrice === null || normalizedPrice <= 0) return 0;

  const targetEstimate = estimatePlayerMarketValue(asContext(target), fundamentalConfig);
  const comparablePlayer = playerFromTransferRecord(transfer);
  const comparableEstimate = estimatePlayerMarketValue(
    { player: comparablePlayer },
    fundamentalConfig
  );
  if (comparableEstimate.estimatedValue.expected <= 0) return normalizedPrice;
  const ratio = targetEstimate.estimatedValue.expected / comparableEstimate.estimatedValue.expected;
  const boundedRatio = clamp(
    ratio,
    1 - config.maximumComparablePriceAdjustment,
    1 + config.maximumComparablePriceAdjustment
  );
  return roundMoney(normalizedPrice * boundedRatio);
}

export function estimateComparableMarketValue(
  target: MarketComparableTarget,
  transfers: readonly PlayerTransferRecord[],
  options: FindMarketComparablesOptions = {},
  fundamentalConfig?: PlayerMarketValueConfig
): ComparableMarketEstimate {
  const config = resolveCalibrationConfig(options);
  const selected = findMarketComparables(target, transfers, options).map((comparable) => ({
    ...comparable,
    adjustedSalePrice: adjustComparablePrice(target, comparable, config, fundamentalConfig)
  }));
  if (selected.length === 0) {
    return {
      comparables: [],
      estimatedValue: null,
      weightedAverage: null,
      weightedMedian: null,
      sampleSize: 0,
      confidence: "low",
      outliers: [],
      priceDispersion: { coefficient: null, low: 0, high: 0, median: null }
    };
  }

  const outlierResult = detectPriceOutliers(selected, config);
  const usable = selected.filter(
    (comparable) => !outlierResult.outlierKeys.has(transferKey(comparable.transfer))
  );
  const values = usable.length > 0 ? usable : selected;
  const weightedAverage = calculateWeightedAverage(values);
  const weightedMedian = calculateWeightedMedian(values);
  const expected = roundMoney(weightedMedian * 0.65 + weightedAverage * 0.35);
  const priceDispersion = calculatePriceDispersion(values);
  const confidence = calculateComparableConfidence(values, priceDispersion, config);
  const estimatedValue = createComparableRange(expected, confidence, priceDispersion, config);
  const outliers = outlierResult.outliers;
  const comparables = selected.map((comparable) => {
    const outlier = outlierResult.outlierKeys.has(transferKey(comparable.transfer))
      ? outliers.find(
          (item) =>
            item.transferId === comparable.transfer.transferId ||
            (item.transferId === undefined && item.price === comparable.adjustedSalePrice)
        )
      : undefined;
    return outlier ? { ...comparable, outlier } : comparable;
  });

  return {
    comparables,
    estimatedValue,
    weightedAverage,
    weightedMedian,
    sampleSize: selected.length,
    confidence,
    outliers,
    priceDispersion
  };
}

export function assessTransferDataQuality(
  transfer: PlayerTransferRecord,
  target?: PlayerMarketValuePlayerInput
): TransferDataQuality {
  if (transfer.dataQuality) return transfer.dataQuality;
  const profile = resolveTransferProfile(transfer) ?? resolveProfile(target ?? null, null);
  const knownSkills = profile
    ? DEVELOPMENT_PROFILES[profile].relevantSkills.filter(
        ({ skill }) => readSkill(transfer.skills, skill) !== null
      ).length
    : Object.values(transfer.skills).filter(
        (value) => typeof value === "number" && Number.isFinite(value)
      ).length;
  const requiredSkills = profile ? DEVELOPMENT_PROFILES[profile].relevantSkills.length : 4;
  if (isValidAge(transfer.age) && knownSkills >= requiredSkills) return "complete";
  if (isValidAge(transfer.age) && knownSkills >= 2) return "partial";
  return "weak";
}

export function deduplicateTransferRecords(
  transfers: readonly PlayerTransferRecord[]
): PlayerTransferRecord[] {
  const byKey = new Map<string, PlayerTransferRecord>();
  for (const transfer of transfers) {
    const key = transferKey(transfer);
    const current = byKey.get(key);
    if (
      !current ||
      transferQualityRank(transfer) > transferQualityRank(current) ||
      (transferQualityRank(transfer) === transferQualityRank(current) &&
        transferFingerprint(transfer) < transferFingerprint(current))
    ) {
      byKey.set(key, transfer);
    }
  }
  return [...byKey.values()].sort(compareTransfers);
}

export function transferKey(transfer: PlayerTransferRecord): string {
  if (transfer.transferId) return `id:${transfer.transferId}`;
  const date = Number.isFinite(transfer.transferDate.getTime())
    ? transfer.transferDate.toISOString()
    : "invalid-date";
  return `player:${transfer.playerId ?? "unknown"}|date:${date}|price:${transfer.salePrice}`;
}

function calculateSkillSimilarity(
  targetSkills: SkillSet,
  comparableSkills: SkillSet,
  profile: DevelopmentProfile | null
): number | null {
  const relevantSkills = profile
    ? DEVELOPMENT_PROFILES[profile].relevantSkills
    : Object.keys(targetSkills).map((skill) => ({
        skill: skill as SkillKey,
        priority: "supporting" as const,
        defaultTargetLevel: 0
      }));
  const known = relevantSkills
    .map((item) => ({
      ...item,
      target: readSkill(targetSkills, item.skill),
      comparable: readSkill(comparableSkills, item.skill)
    }))
    .filter(
      (item): item is typeof item & { target: number; comparable: number } =>
        item.target !== null && item.comparable !== null
    );
  if (known.length === 0) return null;
  const totalWeight = known.reduce(
    (total, item) => total + DEVELOPMENT_PRIORITY_WEIGHTS[item.priority],
    0
  );
  const distance = known.reduce((total, item) => {
    const curveDistance = Math.abs(
      calculateMarketSkillCurve(item.target) - calculateMarketSkillCurve(item.comparable)
    );
    const maxCurve = calculateMarketSkillCurve(VALID_MAXIMUM_SKILL);
    return (
      total + (curveDistance / Math.max(maxCurve, 1)) * DEVELOPMENT_PRIORITY_WEIGHTS[item.priority]
    );
  }, 0);
  return clamp(1 - distance / Math.max(totalWeight, 1), 0, 1);
}

function calculateProfileSimilarity(
  targetProfile: DevelopmentProfile | null,
  comparableProfile: DevelopmentProfile | null,
  target: PlayerMarketValuePlayerInput,
  comparable: PlayerTransferRecord
): number {
  if (targetProfile && comparableProfile) {
    if (targetProfile === comparableProfile) return 1;
    if (formationForProfile(targetProfile) === formationForProfile(comparableProfile)) return 0.78;
    return 0.35;
  }
  const targetFormation = target.formation ?? formationForProfile(targetProfile);
  const comparableFormation = comparable.formation ?? formationForProfile(comparableProfile);
  if (targetFormation && comparableFormation)
    return targetFormation === comparableFormation ? 0.72 : 0.35;
  return 0.5;
}

function calculateComparableDifferences(
  target: MarketComparableTarget,
  comparable: PlayerTransferRecord
): ComparableDifference[] {
  const targetPlayer = readPlayer(target);
  const targetProfile = resolveProfile(targetPlayer, readContextProfile(target));
  const comparableProfile = resolveTransferProfile(comparable);
  const differences: ComparableDifference[] = [];
  if (targetPlayer.age !== comparable.age)
    differences.push({ type: "age", target: targetPlayer.age ?? 0, comparable: comparable.age });
  const profile = targetProfile ?? comparableProfile;
  if (profile) {
    for (const { skill } of DEVELOPMENT_PROFILES[profile].relevantSkills) {
      const targetLevel = readSkill(targetPlayer.skills, skill);
      const comparableLevel = readSkill(comparable.skills, skill);
      if (targetLevel !== null && comparableLevel !== null && targetLevel !== comparableLevel) {
        differences.push({
          type: "skill",
          skill,
          target: targetLevel,
          comparable: comparableLevel
        });
      }
    }
  }
  if (targetProfile !== comparableProfile) {
    differences.push({ type: "profile", target: targetProfile, comparable: comparableProfile });
  }
  return differences;
}

function resolveProfile(
  player: PlayerMarketValuePlayerInput | null,
  explicitProfile: DevelopmentProfile | null | undefined
): DevelopmentProfile | null {
  if (explicitProfile) return explicitProfile;
  if (!player) return null;
  const developmentPlayer: DevelopmentPlayer = {
    playerId: player.playerId,
    age: player.age,
    skills: player.skills,
    formation: player.formation ?? formationFromTrainingPosition(player.training?.position),
    position: player.position,
    observedPosition: player.observedPosition
  };
  return suggestDevelopmentProfile(developmentPlayer).profile;
}

function resolveTransferProfile(transfer: PlayerTransferRecord): DevelopmentProfile | null {
  if (transfer.developmentProfile) return transfer.developmentProfile;
  const player = playerFromTransferRecord(transfer);
  return resolveProfile(player, null);
}

function readContextProfile(target: MarketComparableTarget): DevelopmentProfile | null {
  return "player" in target ? (target.developmentProfile ?? null) : (target.profile ?? null);
}

function readPlayer(target: MarketComparableTarget): PlayerMarketValuePlayerInput {
  return "player" in target ? target.player : target;
}

function asContext(target: MarketComparableTarget): PlayerMarketValueContext {
  return "player" in target ? target : { player: target };
}

export function playerFromTransferRecord(
  transfer: PlayerTransferRecord
): PlayerMarketValuePlayerInput {
  return {
    playerId: transfer.playerId ?? 0,
    age: transfer.age,
    skills: transfer.skills,
    formation: transfer.formation,
    profile: transfer.developmentProfile,
    sokkerValue: transfer.sokkerValue,
    value: transfer.normalizedSalePrice ?? transfer.salePrice
  };
}

function normalizeSalePrice(
  transfer: PlayerTransferRecord,
  options: FindMarketComparablesOptions,
  config: MarketCalibrationConfig
): number | null {
  const price = transfer.normalizedSalePrice ?? transfer.salePrice;
  if (!Number.isFinite(price) || price < 0) return null;
  if (transfer.normalizedSalePrice !== undefined && transfer.normalizedSalePrice !== null)
    return price;
  if (options.currencyNormalizer)
    return options.currencyNormalizer.normalize(price, transfer.currency);
  const baseCurrency = options.baseCurrency ?? config.baseCurrency;
  const currency = transfer.currency ?? baseCurrency;
  if (!baseCurrency || !currency || currency === baseCurrency) return price;
  const rate = options.currencyRates?.[currency] ?? config.currencyRates[currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
  const normalized = price * rate;
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
}

function calculateTransferDataQualityWeight(
  quality: TransferDataQuality,
  config: MarketCalibrationConfig
): number {
  if (quality === "complete") return config.completeDataQualityWeight;
  if (quality === "partial") return config.partialDataQualityWeight;
  return config.weakDataQualityWeight;
}

function calculateComparableConfidence(
  comparables: readonly MarketComparable[],
  dispersion: { coefficient: number | null },
  config: MarketCalibrationConfig
): "low" | "medium" | "high" {
  if (comparables.length === 0) return "low";
  const averageSimilarity = weightedMetric(comparables, (item) => item.similarityScore);
  const averageRecency = weightedMetric(comparables, (item) => item.recencyWeight);
  const strongCount = comparables.filter(
    (item) =>
      item.dataQualityWeight >= config.completeDataQualityWeight && item.similarityScore >= 0.8
  ).length;
  if (
    strongCount >= config.minimumSamplesForHighConfidence &&
    averageSimilarity >= 0.8 &&
    averageRecency >= 0.6 &&
    (dispersion.coefficient ?? 1) <= 0.25
  ) {
    return "high";
  }
  if (
    comparables.length >= config.minimumSamplesForMediumConfidence &&
    averageSimilarity >= 0.65 &&
    (dispersion.coefficient ?? 1) <= 0.55
  ) {
    return "medium";
  }
  return "low";
}

function detectPriceOutliers(
  comparables: readonly MarketComparable[],
  config: MarketCalibrationConfig
): { outlierKeys: Set<string>; outliers: ComparableMarketOutlier[] } {
  const median = calculateMedian(comparables.map((item) => item.adjustedSalePrice));
  const deviations = comparables.map((item) => Math.abs(item.adjustedSalePrice - median));
  const mad = calculateMedian(deviations);
  const tolerance = Math.max(
    mad * config.outlierMadMultiplier,
    median * config.outlierRelativeTolerance
  );
  const outlierComparables = comparables.filter(
    (item) => Math.abs(item.adjustedSalePrice - median) > tolerance
  );
  const outliers = outlierComparables.map((item): ComparableMarketOutlier => ({
    ...(item.transfer.transferId ? { transferId: item.transfer.transferId } : {}),
    price: item.adjustedSalePrice,
    reason: "robust_price_deviation"
  }));
  return {
    outlierKeys: new Set(outlierComparables.map((item) => transferKey(item.transfer))),
    outliers
  };
}

function calculateWeightedAverage(comparables: readonly MarketComparable[]): number {
  const totalWeight = comparables.reduce((total, item) => total + item.adjustedSimilarityScore, 0);
  if (totalWeight <= 0) return 0;
  return roundMoney(
    comparables.reduce(
      (total, item) => total + item.adjustedSalePrice * item.adjustedSimilarityScore,
      0
    ) / totalWeight
  );
}

function calculateWeightedMedian(comparables: readonly MarketComparable[]): number {
  const ordered = [...comparables].sort(
    (left, right) =>
      left.adjustedSalePrice - right.adjustedSalePrice || compareComparables(left, right)
  );
  const totalWeight = ordered.reduce((total, item) => total + item.adjustedSimilarityScore, 0);
  let accumulated = 0;
  for (const item of ordered) {
    accumulated += item.adjustedSimilarityScore;
    if (accumulated >= totalWeight / 2) return item.adjustedSalePrice;
  }
  return ordered.at(-1)?.adjustedSalePrice ?? 0;
}

function calculatePriceDispersion(comparables: readonly MarketComparable[]): {
  coefficient: number | null;
  low: number;
  high: number;
  median: number | null;
} {
  if (comparables.length === 0) return { coefficient: null, low: 0, high: 0, median: null };
  const prices = comparables.map((item) => item.adjustedSalePrice);
  const median = calculateMedian(prices);
  const average = prices.reduce((total, price) => total + price, 0) / prices.length;
  const standardDeviation = Math.sqrt(
    prices.reduce((total, price) => total + Math.pow(price - average, 2), 0) / prices.length
  );
  return {
    coefficient: median > 0 ? standardDeviation / median : null,
    low: Math.min(...prices),
    high: Math.max(...prices),
    median
  };
}

function createComparableRange(
  expected: number,
  confidence: "low" | "medium" | "high",
  dispersion: { coefficient: number | null },
  config: MarketCalibrationConfig
): MarketValueRange {
  const spread = clamp(
    config.rangeSpreadByConfidence[confidence] + Math.min(dispersion.coefficient ?? 0, 0.5) * 0.15,
    0.1,
    0.5
  );
  return {
    low: Math.max(0, roundMoney(expected * (1 - spread))),
    expected: Math.max(0, roundMoney(expected)),
    high: Math.max(0, roundMoney(expected * (1 + spread)))
  };
}

function weightedMetric(
  comparables: readonly MarketComparable[],
  metric: (item: MarketComparable) => number
): number {
  const totalWeight = comparables.reduce((total, item) => total + item.adjustedSimilarityScore, 0);
  return totalWeight > 0
    ? comparables.reduce((total, item) => total + metric(item) * item.adjustedSimilarityScore, 0) /
        totalWeight
    : 0;
}

function resolveCalibrationConfig(options: FindMarketComparablesOptions): MarketCalibrationConfig {
  return {
    ...MARKET_CALIBRATION_CONFIG,
    ...(options.calibrationConfig ?? {}),
    ...(options.maxComparables === undefined ? {} : { maxComparables: options.maxComparables }),
    ...(options.minimumSimilarity === undefined
      ? {}
      : { minimumSimilarity: options.minimumSimilarity }),
    ...(options.baseCurrency === undefined ? {} : { baseCurrency: options.baseCurrency }),
    ...(options.currencyRates === undefined ? {} : { currencyRates: options.currencyRates })
  };
}

function compareComparables(left: MarketComparable, right: MarketComparable): number {
  return (
    right.adjustedSimilarityScore - left.adjustedSimilarityScore ||
    right.similarityScore - left.similarityScore ||
    right.transfer.transferDate.getTime() - left.transfer.transferDate.getTime() ||
    transferKey(left.transfer).localeCompare(transferKey(right.transfer))
  );
}

function compareTransfers(left: PlayerTransferRecord, right: PlayerTransferRecord): number {
  return (
    left.transferDate.getTime() - right.transferDate.getTime() ||
    transferKey(left).localeCompare(transferKey(right))
  );
}

function latestTransferDate(transfers: readonly PlayerTransferRecord[]): Date | null {
  const latest = transfers
    .filter((transfer) => isUsableTransferDate(transfer.transferDate))
    .map((transfer) => transfer.transferDate.getTime())
    .sort((left, right) => right - left)[0];
  return latest === undefined ? null : new Date(latest);
}

function transferQualityRank(transfer: PlayerTransferRecord): number {
  const quality = transfer.dataQuality ?? "weak";
  return quality === "complete" ? 3 : quality === "partial" ? 2 : 1;
}

function transferFingerprint(transfer: PlayerTransferRecord): string {
  const skills = Object.entries(transfer.skills)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([skill, level]) => `${skill}:${level ?? "null"}`)
    .join(",");
  return [
    transfer.salePrice,
    transfer.normalizedSalePrice ?? "null",
    transfer.currency ?? "null",
    transfer.source,
    transfer.age,
    transfer.formation ?? "null",
    transfer.developmentProfile ?? "null",
    skills
  ].join("|");
}

function formationForProfile(profile: DevelopmentProfile | null): Formation | null {
  if (profile === "goalkeeper") return "GK";
  if (profile === "central_defender" || profile === "wing_defender") return "DEF";
  if (profile === "central_midfielder" || profile === "winger") return "MID";
  if (profile === "forward") return "ATT";
  return null;
}

function formationFromTrainingPosition(position: number | undefined): Formation | null {
  if (position === undefined) return null;
  if (position === 0) return "GK";
  if (position === 1) return "DEF";
  if (position === 3) return "ATT";
  return "MID";
}

function readSkill(skills: SkillSet, skill: SkillKey): number | null {
  const value = skills[skill];
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, 0, VALID_MAXIMUM_SKILL)
    : null;
}

function isValidAge(age: number): boolean {
  return Number.isFinite(age) && age >= VALID_MINIMUM_AGE && age <= VALID_MAXIMUM_AGE;
}

function isUsableTransferDate(date: Date): boolean {
  return date instanceof Date && Number.isFinite(date.getTime());
}

function calculateMedian(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function roundMoney(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

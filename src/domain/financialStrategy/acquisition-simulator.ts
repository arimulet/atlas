import type { SkillSet } from "../types.js";
import type { ClubFinancialAssessment, FinancialPositionStatus } from "./types.js";
import type { CapitalAllocationReason, InvestmentSafetyAssessment } from "./capital-types.js";
import { assessInvestmentSafety } from "./capital-allocation.js";
import type { SquadDepthAnalysis, SquadDepthPlayer } from "../squadPlanning/depth-types.js";
import type { SquadPlanningRecommendations } from "../squadPlanning/recommendation-types.js";
import type { DevelopmentProfile } from "../playerDevelopment/types.js";
import { estimatePlayerMarketValue } from "../playerMarketValue/index.js";
import { calibratePlayerMarketValue } from "../playerMarketValue/calibration.js";
import type { PlayerTransferRecord } from "../playerMarketValue/calibration-types.js";

export interface PlayerAcquisitionSimulationInput {
  amount?: number | null;
  weeklyWage?: number | null;
  age?: number | null;
  position?: "GK" | "DEF" | "MID" | "ATT" | string | null;
  skills?: Record<string, number>;
  name?: string | null;
  playerId?: number | null;
}

export interface AcquisitionSimulationContext {
  financialAssessment: ClubFinancialAssessment;
  squadDepth: SquadDepthAnalysis;
  squadPlanning: SquadPlanningRecommendations;
  squadPlayers?: readonly SquadDepthPlayer[];
  trainingConfiguration?: Record<string, number | null> | null;
  activeAdvancedTraineeCount?: number;
  marketTransfers?: readonly PlayerTransferRecord[];
}

export type AcquisitionRoiVerdict = "high_upside" | "moderate_upside" | "break_even" | "loss" | "not_applicable";

export interface AcquisitionRoiAssessment {
  isYouthProjectable: boolean;
  currentEstimatedValue: number | null;
  projectedValueSeason1: number | null;
  projectedValueSeason2: number | null;
  totalCostSeason1: number | null;
  totalCostSeason2: number | null;
  netMarginSeason1: number | null;
  netMarginSeason2: number | null;
  roiPercentSeason1: number | null;
  roiPercentSeason2: number | null;
  verdict: AcquisitionRoiVerdict;
  headline: string;
  description: string;
}

export interface PlayerAcquisitionSimulationResult {
  input: {
    amount: number;
    weeklyWage: number | null;
    position: string | null;
    age: number | null;
    name: string | null;
    skills: Record<string, number>;
  };
  financial: {
    amount: number;
    weeklyWage: number;
    marketPriceSource: "market_comparables" | "market_calibration" | "fundamental_valuation" | "user_specified";
    comparableCount: number;
    isWageEstimated: boolean;
    postInvestmentCash: number | null;
    postInvestmentStatus: FinancialPositionStatus;
    postInvestmentPayrollCoverageWeeks: number | null;
    currentPayrollCoverageWeeks: number | null;
    currentWeeklyPayroll: number;
    projectedWeeklyPayroll: number;
    safety: InvestmentSafetyAssessment["safety"];
    reasons: CapitalAllocationReason[];
  };
  squadFit: {
    targetProfile: DevelopmentProfile | null;
    profileStatus: "critical" | "thin" | "balanced" | "deep" | "overstocked" | "unknown";
    projectedHierarchy: "starter" | "rotation" | "depth";
    fitVerdict: "high_need" | "successor_need" | "rotation_depth" | "overstocked_risk" | "neutral";
    headline: string;
    description: string;
  };
  training: {
    trainedSkillName: string | null;
    isCompatibleWithClubTraining: boolean;
    hasAdvancedSlotAvailable: boolean;
    activeAdvancedSlotsCount: number;
    headline: string;
    description: string;
  };
  roi: AcquisitionRoiAssessment | null;
}

const POSITION_TO_PROFILE: Record<string, DevelopmentProfile> = {
  GK: "goalkeeper",
  goalkeeper: "goalkeeper",
  DEF: "defender",
  defender: "defender",
  wing_defender: "wing_defender",
  MID: "midfielder",
  midfielder: "midfielder",
  winger: "winger",
  ATT: "forward",
  forward: "forward",
  striker: "forward"
};

const TRAINING_PRIORITY_NAMES: Record<number, string> = {
  1: "Stamina",
  2: "Keeper",
  3: "Playmaking",
  4: "Passing",
  5: "Technique",
  6: "Defending",
  7: "Scoring",
  8: "Pace"
};

const TRAINING_CODE_TO_SKILL_KEY: Record<number, string> = {
  1: "stamina",
  2: "keeper",
  3: "playmaker",
  4: "passing",
  5: "technique",
  6: "defender",
  7: "striker",
  8: "pace"
};

const POSITION_DEFAULT_TRAINING_SKILL: Record<string, string> = {
  GK: "keeper",
  DEF: "defender",
  MID: "playmaker",
  ATT: "striker"
};

export function estimatePlayerWeeklyWage(
  skills: Record<string, number>,
  estimatedValue: number | null
): number {
  if (estimatedValue && estimatedValue > 0) {
    const fromValue = Math.round(estimatedValue / 40);
    return Math.max(1500, Math.min(500_000, fromValue));
  }
  const vals = Object.values(skills);
  const maxS = Math.max(0, ...vals);
  const sumS = vals.reduce((a, b) => a + b, 0);
  const base = 1500 + Math.pow(Math.max(0, maxS - 4), 2.2) * 800 + sumS * 150;
  return Math.round(base);
}

export function inferPositionFromSkills(skills: Record<string, number>): "GK" | "DEF" | "MID" | "ATT" {
  const gk = skills.keeper ?? 0;
  const def = skills.defender ?? (skills as Record<string, number>).defending ?? 0;
  const mid = skills.playmaker ?? (skills as Record<string, number>).playmaking ?? 0;
  const att = skills.striker ?? (skills as Record<string, number>).scoring ?? 0;

  // Keeper check: distinct specialty, keeper >= 4 and strictly higher than outfield primaries
  if (gk >= 4 && gk > def && gk > mid && gk > att) {
    return "GK";
  }

  // Clear dominant primary outfield skill
  if (def > mid && def > att) {
    return "DEF";
  }
  if (att > mid && att > def) {
    return "ATT";
  }
  if (mid > def && mid > att) {
    return "MID";
  }

  // Secondary skills evaluation for ties or close profiles
  const pace = skills.pace ?? 0;
  const passing = skills.passing ?? 0;
  const technique = skills.technique ?? 0;

  const defScore = def * 3 + pace * 1.5 + technique * 1.0;
  const midScore = mid * 3 + passing * 2.0 + technique * 1.5;
  const attScore = att * 3 + pace * 2.0 + technique * 1.5;

  if (defScore > midScore && defScore > attScore) return "DEF";
  if (attScore > midScore && attScore > defScore) return "ATT";
  if (midScore > defScore && midScore > attScore) return "MID";

  // Balanced default
  return "MID";
}

export function simulatePlayerAcquisition(
  context: AcquisitionSimulationContext,
  input: PlayerAcquisitionSimulationInput
): PlayerAcquisitionSimulationResult {
  const normalizedAge = input.age ? Math.max(15, Math.min(45, Number(input.age))) : null;
  const normalizedSkills: Record<string, number> = {};
  if (input.skills) {
    for (const [k, v] of Object.entries(input.skills)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        normalizedSkills[k] = Math.max(0, Math.min(20, v));
      }
    }
  }
  const normalizedPosition: "GK" | "DEF" | "MID" | "ATT" = input.position
    ? (input.position.toUpperCase() as "GK" | "DEF" | "MID" | "ATT")
    : inferPositionFromSkills(normalizedSkills);
  const targetProfile = POSITION_TO_PROFILE[normalizedPosition] ?? null;

  // 1. Resolve Purchase Price from Market Transfers
  let resolvedAmount = 0;
  let marketPriceSource: PlayerAcquisitionSimulationResult["financial"]["marketPriceSource"] = "market_calibration";
  let comparableCount = 0;

  if (input.amount !== undefined && input.amount !== null && Number(input.amount) > 0) {
    resolvedAmount = Math.max(0, Number(input.amount));
    marketPriceSource = "user_specified";
  } else {
    try {
      const calibration = calibratePlayerMarketValue(
        {
          player: {
            playerId: input.playerId ?? 0,
            age: normalizedAge ?? 20,
            skills: normalizedSkills as SkillSet,
            position: (normalizedPosition as "GK" | "DEF" | "MID" | "ATT") ?? undefined
          },
          developmentProfile: targetProfile ?? undefined
        },
        context.marketTransfers ?? []
      );

      if (
        calibration.comparableEstimate &&
        calibration.comparableEstimate.sampleSize > 0 &&
        calibration.comparableEstimate.weightedMedian &&
        calibration.comparableEstimate.weightedMedian > 0
      ) {
        resolvedAmount = calibration.comparableEstimate.weightedMedian;
        marketPriceSource = "market_comparables";
        comparableCount = calibration.comparableEstimate.sampleSize;
      } else if (calibration.calibratedValue && calibration.calibratedValue.expected > 0) {
        resolvedAmount = calibration.calibratedValue.expected;
        marketPriceSource = "market_calibration";
      } else {
        resolvedAmount = calibration.fundamental?.estimatedValue?.expected || 100_000;
        marketPriceSource = "fundamental_valuation";
      }
    } catch {
      resolvedAmount = 100_000;
      marketPriceSource = "fundamental_valuation";
    }
  }

  // 2. Resolve Weekly Wage
  let resolvedWage = 0;
  let isWageEstimated = false;

  if (input.weeklyWage !== undefined && input.weeklyWage !== null && Number(input.weeklyWage) > 0) {
    resolvedWage = Math.max(0, Number(input.weeklyWage));
  } else {
    isWageEstimated = true;
    resolvedWage = estimatePlayerWeeklyWage(normalizedSkills, resolvedAmount);
  }

  // 3. Finanzas & Nómina
  const financialSafety = assessInvestmentSafety(
    context.financialAssessment,
    resolvedAmount,
    undefined,
    { additionalWeeklyPayroll: resolvedWage }
  );

  const currentWeeklyPayroll = context.financialAssessment.payroll.totalWeekly;
  const projectedWeeklyPayroll = currentWeeklyPayroll + resolvedWage;
  const currentPayrollCoverageWeeks = context.financialAssessment.position.metrics.payrollCoverageWeeks;

  // 4. Encaje en Plantilla (Squad Fit)
  const profileDepth = targetProfile
    ? context.squadDepth.profiles.find((p) => p.profile === targetProfile)
    : null;

  const profileStatus = profileDepth ? profileDepth.status : "unknown";

  // Determinar jerarquía estimada comparando con jugadores del mismo perfil
  const squadPlayers = context.squadPlayers ?? [];
  const sameProfilePlayers = targetProfile
    ? squadPlayers.filter((p) => p.profile === targetProfile)
    : [];

  const candidateScore = calculatePositionScore(normalizedPosition, normalizedSkills);
  let projectedHierarchy: "starter" | "rotation" | "depth" = "rotation";

  if (sameProfilePlayers.length === 0) {
    projectedHierarchy = "starter";
  } else {
    const sortedScores = sameProfilePlayers
      .map((p) => calculatePositionScore(normalizedPosition, p.skills as Record<string, number>))
      .sort((a, b) => b - a);

    const topStarterScore = sortedScores[0] ?? 0;
    const backupScore = sortedScores[Math.min(1, sortedScores.length - 1)] ?? 0;

    if (candidateScore >= topStarterScore) {
      projectedHierarchy = "starter";
    } else if (candidateScore >= backupScore * 0.85) {
      projectedHierarchy = "rotation";
    } else {
      projectedHierarchy = "depth";
    }
  }

  let fitVerdict: PlayerAcquisitionSimulationResult["squadFit"]["fitVerdict"] = "neutral";
  let fitHeadline = "Balanced squad fit";
  let fitDescription = "This signing complements team rotation without creating imbalances.";

  if (profileStatus === "critical" || profileStatus === "thin") {
    fitVerdict = "high_need";
    fitHeadline = "Priority reinforcement needed";
    fitDescription = `The ${targetProfile ?? "position"} position has a deficit in the squad. This signing addresses an urgent depth need.`;
  } else if (normalizedAge !== null && normalizedAge <= 21 && profileDepth?.succession.coverageStatus === "missing") {
    fitVerdict = "successor_need";
    fitHeadline = "Key generational successor";
    fitDescription = `The position lacked a designated young successor. This signing secures future succession.`;
  } else if (profileStatus === "overstocked") {
    fitVerdict = "overstocked_risk";
    fitHeadline = "Overstocking risk";
    fitDescription = `The position already has excess players. Adding another player increases wage bill without sporting need.`;
  } else if (projectedHierarchy === "starter") {
    fitVerdict = "high_need";
    fitHeadline = "Direct starting XI upgrade";
    fitDescription = `Based on skill level, the player projects as an immediate starter over current options.`;
  } else {
    fitVerdict = "rotation_depth";
    fitHeadline = "Squad depth option";
    fitDescription = `Provides a reliable bench alternative without creating congestion.`;
  }

  // 3. Training
  const positionKey = normalizedPosition && ["GK", "DEF", "MID", "ATT"].includes(normalizedPosition)
    ? normalizedPosition
    : null;

  const trainingPriorityCode = positionKey && context.trainingConfiguration
    ? context.trainingConfiguration[positionKey]
    : null;

  const trainedSkillName = trainingPriorityCode
    ? TRAINING_PRIORITY_NAMES[trainingPriorityCode] ?? `Skill #${trainingPriorityCode}`
    : null;

  const trainedSkillKey = trainingPriorityCode
    ? TRAINING_CODE_TO_SKILL_KEY[trainingPriorityCode] ?? null
    : (positionKey ? POSITION_DEFAULT_TRAINING_SKILL[positionKey] ?? null : null);

  const isCompatibleWithClubTraining = Boolean(trainingPriorityCode && trainingPriorityCode > 0);
  const activeAdvancedSlotsCount = context.activeAdvancedTraineeCount ?? 0;
  const hasAdvancedSlotAvailable = activeAdvancedSlotsCount < 2;

  let trainHeadline = "Training not configured";
  let trainDescription = "No training assigned for this position in current club settings.";

  if (isCompatibleWithClubTraining) {
    if (normalizedAge !== null && normalizedAge <= 23) {
      if (hasAdvancedSlotAvailable) {
        trainHeadline = `Will train ${trainedSkillName} (Advanced slot available)`;
        trainDescription = `The player will benefit from ${trainedSkillName} training and an advanced slot is available in the club.`;
      } else {
        trainHeadline = `Will train ${trainedSkillName} (No advanced slot)`;
        trainDescription = `Will benefit from ${trainedSkillName} training, but both club advanced slots are currently occupied. Will compete with existing talent.`;
      }
    } else {
      trainHeadline = `Will train ${trainedSkillName} (Senior player)`;
      trainDescription = `Given player age (${normalizedAge} y/o), training progress will be slow or focused on skill maintenance.`;
    }
  }

  // 4. ROI & Retorno (Juveniles <= 21)
  const isYouthProjectable = normalizedAge !== null && normalizedAge <= 21;
  let roiResult: PlayerAcquisitionSimulationResult["roi"] = null;

  if (isYouthProjectable) {
    const mockPlayerInput = {
      playerId: input.playerId ?? 999999,
      age: normalizedAge!,
      skills: normalizedSkills as SkillSet,
      wage: resolvedWage
    };

    let currentVal = estimateSafeMarketValue(mockPlayerInput);
    if (currentVal === null || currentVal <= 0) {
      currentVal = resolvedAmount > 0 ? resolvedAmount : 50000;
    }

    const skillToBoost = trainedSkillKey ?? "technique";

    // Proyección a 1 temporada (16 semanas): +2 en habilidad entrenada, edad +1
    const skillsS1 = {
      ...normalizedSkills,
      [skillToBoost]: (normalizedSkills[skillToBoost] ?? 5) + 2
    };
    let valS1 = estimateSafeMarketValue({
      ...mockPlayerInput,
      age: normalizedAge! + 1,
      skills: skillsS1 as SkillSet
    });
    if (valS1 === null || valS1 <= currentVal) {
      valS1 = Math.round(currentVal * 1.55);
    }

    // Proyección a 2 temporadas (32 semanas): +4 en habilidad entrenada, edad +2
    const skillsS2 = {
      ...normalizedSkills,
      [skillToBoost]: (normalizedSkills[skillToBoost] ?? 5) + 4
    };
    let valS2 = estimateSafeMarketValue({
      ...mockPlayerInput,
      age: normalizedAge! + 2,
      skills: skillsS2 as SkillSet
    });
    if (valS2 === null || valS2 <= valS1) {
      valS2 = Math.round(valS1 * 1.45);
    }

    const wageWeekly = resolvedWage;
    const totalCostS1 = resolvedAmount + wageWeekly * 16;
    const totalCostS2 = resolvedAmount + wageWeekly * 32;

    const netMarginS1 = valS1 - totalCostS1;
    const netMarginS2 = valS2 - totalCostS2;

    const roiPercentS1 = totalCostS1 > 0 ? Math.round((netMarginS1 / totalCostS1) * 100) : 0;
    const roiPercentS2 = totalCostS2 > 0 ? Math.round((netMarginS2 / totalCostS2) * 100) : 0;

    let verdict: AcquisitionRoiVerdict = "break_even";
    let roiHeadline = "Break-even investment";
    let roiDescription = "Projected value generated will roughly cover transfer fee and accumulated wages.";

    if (roiPercentS1 >= 50 || roiPercentS2 >= 75) {
      verdict = "high_upside";
      roiHeadline = "High projected upside";
      roiDescription = "Excellent potential trading return. Resale value is expected to comfortably surpass purchase fee and wages.";
    } else if (netMarginS1 > 0 || netMarginS2 > 0) {
      verdict = "moderate_upside";
      roiHeadline = "Moderate positive return";
      roiDescription = "Resale yields a net profit after amortizing purchase fee and wages.";
    } else {
      verdict = "loss";
      roiHeadline = "Negative return / Deficit expected";
      roiDescription = "Accumulated purchase fee and wages exceed projected market value after training.";
    }

    roiResult = {
      isYouthProjectable: true,
      currentEstimatedValue: currentVal,
      projectedValueSeason1: valS1,
      projectedValueSeason2: valS2,
      totalCostSeason1: totalCostS1,
      totalCostSeason2: totalCostS2,
      netMarginSeason1: netMarginS1,
      netMarginSeason2: netMarginS2,
      roiPercentSeason1: roiPercentS1,
      roiPercentSeason2: roiPercentS2,
      verdict,
      headline: roiHeadline,
      description: roiDescription
    };
  }

  return {
    input: {
      amount: resolvedAmount,
      weeklyWage: resolvedWage,
      position: normalizedPosition,
      age: normalizedAge,
      name: input.name ?? null,
      skills: normalizedSkills
    },
    financial: {
      amount: resolvedAmount,
      weeklyWage: resolvedWage,
      marketPriceSource,
      comparableCount,
      isWageEstimated,
      postInvestmentCash: financialSafety.postInvestmentCash,
      postInvestmentStatus: financialSafety.postInvestmentStatus,
      postInvestmentPayrollCoverageWeeks: financialSafety.postInvestmentPayrollCoverageWeeks,
      currentPayrollCoverageWeeks,
      currentWeeklyPayroll,
      projectedWeeklyPayroll,
      safety: financialSafety.safety,
      reasons: financialSafety.reasons
    },
    squadFit: {
      targetProfile,
      profileStatus,
      projectedHierarchy,
      fitVerdict,
      headline: fitHeadline,
      description: fitDescription
    },
    training: {
      trainedSkillName,
      isCompatibleWithClubTraining,
      hasAdvancedSlotAvailable,
      activeAdvancedSlotsCount,
      headline: trainHeadline,
      description: trainDescription
    },
    roi: roiResult
  };
}

function estimateSafeMarketValue(playerInput: Parameters<typeof estimatePlayerMarketValue>[0]["player"]): number | null {
  try {
    const result = estimatePlayerMarketValue({ player: playerInput });
    return result.estimatedValue?.expected ?? null;
  } catch {
    return null;
  }
}

function calculatePositionScore(position: string | null, skills: Record<string, number>): number {
  if (!position) return 0;
  const p = position.toUpperCase();
  if (p === "GK") {
    return (skills.keeper ?? 0) * 0.7 + (skills.pace ?? 0) * 0.15 + (skills.passing ?? 0) * 0.15;
  }
  if (p === "DEF") {
    return (skills.defender ?? 0) * 0.5 + (skills.pace ?? 0) * 0.2 + (skills.technique ?? 0) * 0.15 + (skills.passing ?? 0) * 0.15;
  }
  if (p === "MID") {
    return (skills.playmaker ?? 0) * 0.45 + (skills.passing ?? 0) * 0.25 + (skills.technique ?? 0) * 0.2 + (skills.pace ?? 0) * 0.1;
  }
  if (p === "ATT") {
    return (skills.striker ?? 0) * 0.5 + (skills.pace ?? 0) * 0.25 + (skills.technique ?? 0) * 0.15 + (skills.passing ?? 0) * 0.1;
  }
  return 0;
}

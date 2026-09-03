import type {
  CapitalAllocationItem,
  ClubFinancialAssessment,
  FinancialPositionStatus,
  FinancialStrategyPlan,
  FinancialStrategyRecommendation,
  InvestmentSafetyAssessment,
  ProfileDepthStatus
} from "@atlas/domain";
import type { FinancialStrategyData } from "../../api";
import type { SquadPlanningBundle } from "../../types";
import { formatMoney } from "../../formatters";

export interface FinancialPositionViewModel {
  status: FinancialPositionStatus;
  statusLabel: string;
  confidence: string;
  cash: string;
  squadValue: string;
  squadValueCoverage: string;
  knownCapital: string;
  payroll: string;
  payrollCoverage: string;
  liquidity: string;
  reasons: string[];
  warnings: string[];
  provenance: {
    cash: string;
    squadValue: string;
    developmentValue: string;
  };
}

export interface CapitalCapacityViewModel {
  reserve: string;
  reserveWeeks: string;
  spendableCash: string;
  conservative: string;
  maximumRecommended: string;
  confidence: string;
  status: string;
}

export interface StrategicFundingViewModel {
  needs: Array<{
    id: string;
    profile: string;
    priority: string;
    horizon: string;
    expectedCost: string;
    allocated: string;
    gap: string;
    status: string;
    timing: string;
  }>;
  totalGap: string;
}

export interface FinancialRecommendationViewModel {
  id: string;
  type: FinancialStrategyRecommendation["type"];
  title: string;
  description: string;
  priority: string;
  horizon: string;
  confidence: string;
  playerIds: number[];
  playerNames: string[];
  profile: string | null;
  financialImpact: string[];
  reasons: string[];
  risks: string[];
}

export interface SquadAssetViewModel {
  estimatedValue: string;
  coverage: string;
  knownCapital: string;
  liquidity: string;
  concentration: string;
  concentrationWarning: boolean;
  distribution: Array<{ role: string; value: string }>;
  potentialLiquidity: string;
  monetizable: Array<{
    playerId: number;
    name: string;
    value: string;
    role: string;
    liquidity: string;
    recommended: boolean;
    isTheoretical: boolean;
  }>;
  protectedAssets: Array<{ playerId: number; name: string; value: string; reasons: string[]; isTheoretical: boolean }>;
}

export interface DevelopmentCapitalViewModel {
  coveredPlayers: string;
  currentValue: string;
  projectedValue: string;
  valueCreation: string;
  confidence: string;
}

export interface FinancialStrategyViewModel {
  position: FinancialPositionViewModel;
  capacity: CapitalCapacityViewModel;
  funding: StrategicFundingViewModel;
  recommendations: FinancialRecommendationViewModel[];
  assets: SquadAssetViewModel;
  developmentCapital: DevelopmentCapitalViewModel | null;
  conflicts: Array<{ playerId: number | null; playerName: string | null; description: string }>;
  criticalRecommendations: FinancialRecommendationViewModel[];
}

export function createFinancialStrategyViewModel(
  data: FinancialStrategyData,
  currency: string | null,
  squadPlanning: SquadPlanningBundle | null
): FinancialStrategyViewModel {
  const playerNames = createPlayerNameMap(squadPlanning);
  const position = createPositionViewModel(data.financialAssessment, currency);
  const recommendations = data.strategyPlan.recommendations.map((recommendation) =>
    createRecommendationViewModel(recommendation, data.strategyPlan, currency, playerNames)
  );

  return {
    position,
    capacity: createCapacityViewModel(data.capitalAllocation, currency),
    funding: createFundingViewModel(data.capitalAllocation, currency),
    recommendations,
    assets: createAssetViewModel(data, currency, playerNames),
    developmentCapital: createDevelopmentCapitalViewModel(data.financialAssessment, currency),
    conflicts: data.strategyPlan.conflicts.map((conflict) => ({
      playerId: conflict.playerId ?? null,
      playerName:
        conflict.playerId === undefined ? null : (playerNames.get(conflict.playerId) ?? null),
      description: conflictDescription(conflict.type)
    })),
    criticalRecommendations: recommendations.filter(
      (recommendation) =>
        recommendation.priority === "Critical" || recommendation.priority === "High"
    )
  };
}

export function createInvestmentSafetyViewModel(
  assessment: InvestmentSafetyAssessment | null,
  currency: string | null
): { cash: string; coverage: string; status: string; safety: string } | null {
  if (!assessment) return null;
  return {
    cash: money(assessment.postInvestmentCash, currency),
    coverage: weeks(assessment.postInvestmentPayrollCoverageWeeks),
    status: financialStatusLabel(assessment.postInvestmentStatus),
    safety: titleCase(assessment.safety)
  };
}

function createPositionViewModel(
  assessment: ClubFinancialAssessment,
  currency: string | null
): FinancialPositionViewModel {
  const position = assessment.position;
  return {
    status: position.status,
    statusLabel: financialStatusLabel(position.status),
    confidence: titleCase(assessment.confidence),
    cash: money(position.cash, currency),
    squadValue: money(position.squadAssetValue.expected, currency),
    squadValueCoverage: `${position.squadAssetValue.valuedPlayers}/${position.squadAssetValue.totalPlayers} players valued`,
    knownCapital: money(position.knownCapital.expected, currency),
    payroll: money(assessment.payroll.totalWeekly, currency),
    payrollCoverage: weeks(position.metrics.payrollCoverageWeeks),
    liquidity: percentage(position.metrics.liquidityRatio),
    reasons: assessment.strengths.slice(0, 3).map(financialStrengthLabel),
    warnings: assessment.warnings.slice(0, 3).map(financialWarningLabel),
    provenance: {
      cash: titleCase(position.provenance.cash),
      squadValue: titleCase(position.provenance.squadAssetValue),
      developmentValue: titleCase(position.provenance.developmentCapital)
    }
  };
}

function createCapacityViewModel(
  allocation: FinancialStrategyData["capitalAllocation"],
  currency: string | null
): CapitalCapacityViewModel {
  return {
    reserve: money(allocation.reserve.minimumCashReserve, currency),
    reserveWeeks: `${allocation.reserve.reserveBasis.knownPayrollWeeks} known payroll weeks`,
    spendableCash: money(allocation.spendableCash.availableCash, currency),
    conservative: money(allocation.investmentCapacity.conservative, currency),
    maximumRecommended: money(allocation.investmentCapacity.maximumRecommended, currency),
    confidence: titleCase(allocation.confidence),
    status: titleCase(allocation.status)
  };
}

function createFundingViewModel(
  allocation: FinancialStrategyData["capitalAllocation"],
  currency: string | null
): StrategicFundingViewModel {
  const allocationByNeed = new Map(
    allocation.allocation.map((item) => [item.strategicNeedId, item])
  );
  return {
    needs: allocation.strategicNeeds.map((need) => {
      const item = allocationByNeed.get(need.id);
      const gap = allocation.fundingGaps.find((candidate) => candidate.strategicNeedId === need.id);
      return {
        id: need.id,
        profile: profileLabel(need.profile),
        priority: titleCase(need.priority),
        horizon: horizonLabel(need.horizon),
        expectedCost: need.estimatedCapitalRequirement
          ? moneyRange(need.estimatedCapitalRequirement, currency)
          : "—",
        allocated: item ? money(item.allocatedAmount, currency) : "—",
        gap: gap ? money(gap.gap, currency) : "—",
        status: fundingStatus(item),
        timing: item ? timingLabel(item) : horizonLabel(need.horizon)
      };
    }),
    totalGap: money(
      allocation.fundingGaps.reduce((total, gap) => total + gap.gap, 0),
      currency
    )
  };
}

function createRecommendationViewModel(
  recommendation: FinancialStrategyRecommendation,
  plan: FinancialStrategyPlan,
  currency: string | null,
  playerNames: ReadonlyMap<number, string>
): FinancialRecommendationViewModel {
  const names = (recommendation.playerIds ?? []).map(
    (playerId) => playerNames.get(playerId) ?? `Player ${playerId}`
  );
  const profile = recommendation.profile ? profileLabel(recommendation.profile) : null;
  return {
    id: recommendation.id,
    type: recommendation.type,
    title: recommendationTitle(recommendation.type, profile, names),
    description: recommendationDescription(recommendation.type, profile, names),
    priority: titleCase(recommendation.priority),
    horizon: horizonLabel(recommendation.horizon),
    confidence: titleCase(recommendation.confidence),
    playerIds: recommendation.playerIds ?? [],
    playerNames: names,
    profile,
    financialImpact: financialImpactLabels(recommendation, currency),
    reasons: recommendation.reasons.map((reason) => financialReasonLabel(reason, playerNames)),
    risks: recommendation.risks.map((risk) => financialRiskLabel(risk))
  };
}

function createAssetViewModel(
  data: FinancialStrategyData,
  currency: string | null,
  playerNames: ReadonlyMap<number, string>
): SquadAssetViewModel {
  const assessment = data.financialAssessment;
  const allocation = data.capitalAllocation;
  const recommendationPlayerIds = new Set(
    data.strategyPlan.recommendations
      .filter((recommendation) => recommendation.type === "monetize_surplus_asset")
      .flatMap((recommendation) => recommendation.playerIds ?? [])
  );
  const protectedPlayerIds = new Set(
    data.strategyPlan.monetizationCandidates
      .filter(
        (c) => c.strategicProtection === "critical" || c.strategicProtection === "high"
      )
      .map((c) => c.playerId)
  );

  return {
    estimatedValue: money(assessment.squadAssets.expected, currency),
    coverage: `${assessment.squadAssets.valuedPlayers}/${assessment.squadAssets.totalPlayers} players valued`,
    knownCapital: money(assessment.position.knownCapital.expected, currency),
    liquidity: percentage(assessment.position.metrics.liquidityRatio),
    concentration: percentage(assessment.squadAssets.concentration?.top3Share ?? null),
    concentrationWarning: assessment.warnings.some(
      (warning) => warning.type === "high_asset_concentration"
    ),
    distribution: assessment.squadAssets.distribution
      ? Object.entries(assessment.squadAssets.distribution).map(([role, value]) => ({
          role: roleLabel(role),
          value: money(value, currency)
        }))
      : [],
    potentialLiquidity: money(allocation.potentialAssetLiquidity, currency),
    monetizable: allocation.monetizableAssets
      .filter((asset) => asset.liquidityPotential !== "low" && asset.estimatedMarketValue !== null && !protectedPlayerIds.has(asset.playerId))
      .sort((left, right) => (right.estimatedMarketValue ?? 0) - (left.estimatedMarketValue ?? 0))
      .map((asset) => ({
        playerId: asset.playerId,
        name: playerNames.get(asset.playerId) ?? `Player ${asset.playerId}`,
        value: money(asset.estimatedMarketValue, currency),
        role: roleLabel(asset.squadRole),
        liquidity: titleCase(asset.liquidityPotential),
        recommended: recommendationPlayerIds.has(asset.playerId),
        isTheoretical: asset.isTheoretical
      })),
    protectedAssets: data.strategyPlan.monetizationCandidates
      .filter(
        (candidate) =>
          candidate.strategicProtection === "critical" || candidate.strategicProtection === "high"
      )
      .map((candidate) => ({
        playerId: candidate.playerId,
        name: playerNames.get(candidate.playerId) ?? `Player ${candidate.playerId}`,
        value: money(candidate.marketValue, currency),
        reasons: candidate.reasons.map((reason) => monetizationReasonLabel(reason)),
        isTheoretical: candidate.isTheoretical
      }))
  };
}

function createDevelopmentCapitalViewModel(
  assessment: ClubFinancialAssessment,
  currency: string | null
): DevelopmentCapitalViewModel | null {
  const development = assessment.developmentCapital;
  if (!development) return null;
  return {
    coveredPlayers: `${development.playersCovered}/${assessment.squadAssets.totalPlayers} players projected`,
    currentValue: money(development.currentValue, currency),
    projectedValue: money(development.projectedTargetValue, currency),
    valueCreation: signedMoney(development.projectedValueCreation, currency),
    confidence: titleCase(development.confidence)
  };
}

function createPlayerNameMap(squadPlanning: SquadPlanningBundle | null): Map<number, string> {
  return new Map(
    (squadPlanning?.assessment.depthPlayers ?? []).map((player) => [
      player.playerId,
      player.playerName ?? `Player ${player.playerId}`
    ])
  );
}

function financialImpactLabels(
  recommendation: FinancialStrategyRecommendation,
  currency: string | null
): string[] {
  const impact = recommendation.financialImpact;
  if (!impact) return [];
  const labels: string[] = [];
  if (impact.estimatedCashCommitment !== undefined && impact.estimatedCashCommitment !== null)
    labels.push(`Estimated commitment: ${money(impact.estimatedCashCommitment, currency)}`);
  if (impact.estimatedCashRelease !== undefined && impact.estimatedCashRelease !== null)
    labels.push(`Estimated cash release: ${money(impact.estimatedCashRelease, currency)}`);
  if (impact.postActionCash !== undefined && impact.postActionCash !== null)
    labels.push(`Post-action cash: ${money(impact.postActionCash, currency)}`);
  if (impact.postActionFinancialStatus)
    labels.push(`Post-action position: ${financialStatusLabel(impact.postActionFinancialStatus)}`);
  return labels;
}

function recommendationTitle(
  type: FinancialStrategyRecommendation["type"],
  profile: string | null,
  names: readonly string[]
): string {
  const player = names[0] ?? "strategic asset";
  switch (type) {
    case "fund_priority_need":
      return `Fund ${profile ?? "priority squad"} need`;
    case "protect_strategic_asset":
      return `Protect ${player}`;
    case "monetize_surplus_asset":
      return `Monetize ${player}`;
    case "develop_before_monetizing":
      return `Develop ${player} before monetizing`;
    case "delay_recruitment":
      return `Delay ${profile ?? "recruitment"}`;
    case "build_liquidity":
      return "Build liquidity";
    case "preserve_cash":
      return "Preserve cash";
    case "invest_in_squad":
      return "Invest in squad";
    case "maintain_position":
      return "Maintain financial position";
    case "monitor":
      return "Monitor financial strategy";
  }
}

function recommendationDescription(
  type: FinancialStrategyRecommendation["type"],
  profile: string | null,
  names: readonly string[]
): string {
  const player = names[0] ?? "This asset";
  switch (type) {
    case "fund_priority_need":
      return `A ${profile ?? "priority"} need can be funded within current capacity.`;
    case "protect_strategic_asset":
      return `${player} has high sporting importance and should not be treated as immediate liquidity.`;
    case "monetize_surplus_asset":
      return `${player} is a reasonable liquidity candidate without an identified core dependency.`;
    case "develop_before_monetizing":
      return `${player} has projected short-term value growth that may justify further development.`;
    case "delay_recruitment":
      return `The ${profile ?? "recruitment"} need should wait for safer financial capacity or an internal solution.`;
    case "build_liquidity":
      return "Potential liquidity should be prepared without selecting a transfer action automatically.";
    case "preserve_cash":
      return "Current safety margins or priority funding gaps favor protecting liquidity.";
    case "invest_in_squad":
      return "Available capacity can support an identified sporting need.";
    case "maintain_position":
      return "No material financial action is required from the current evidence.";
    case "monitor":
      return "The signal is relevant, but evidence is not strong enough for a material action.";
  }
}

function financialReasonLabel(
  reason: FinancialStrategyRecommendation["reasons"][number],
  playerNames: ReadonlyMap<number, string>
): string {
  switch (reason.type) {
    case "financial_position_strained":
      return "Financial position is strained";
    case "ample_investment_capacity":
      return "Investment capacity is available";
    case "priority_squad_need":
      return `Priority ${profileLabel(reason.profile)} need`;
    case "need_fully_fundable":
      return "Need is fully fundable within the protected capacity";
    case "need_not_safely_fundable":
      return "Need is not safely fundable at this time";
    case "profile_overstocked":
      return `${profileLabel(reason.profile)} pipeline is overstocked`;
    case "asset_has_high_market_value":
      return `High market value for ${playerNames.get(reason.playerId) ?? `Player ${reason.playerId}`}`;
    case "asset_has_low_strategic_importance":
      return "Low strategic importance";
    case "no_ready_successor":
      return "No ready successor is available";
    case "strong_short_term_value_growth":
      return "Strong short-term value growth";
    case "advanced_resource_conflict":
      return "Advanced training resource conflict";
    case "funding_gap":
      return `Funding gap: ${money(reason.amount, null)}`;
  }
}

function financialRiskLabel(risk: FinancialStrategyRecommendation["risks"][number]): string {
  switch (risk.type) {
    case "market_value_uncertain":
      return "Market value evidence is uncertain";
    case "liquidity_reduction":
      return "The action would reduce liquidity";
    case "squad_depth_damage":
      return "The action may damage squad depth";
    case "succession_risk_created":
      return "The action may create a succession risk";
    case "training_resource_opportunity_cost":
      return "Training resources have an opportunity cost";
    case "long_horizon_uncertainty":
      return "Long-horizon projections are uncertain";
  }
}

function monetizationReasonLabel(reason: { type: string }): string {
  switch (reason.type) {
    case "core_asset":
      return "Core asset";
    case "missing_successor":
      return "No ready successor";
    case "high_future_contribution":
      return "High future contribution";
    case "strong_profile_need":
      return "Strong profile need";
    case "high_market_value":
      return "High market value";
    case "profile_overstocked":
      return "Profile overstocked";
    case "low_strategic_importance":
      return "Low strategic importance";
    case "successor_covered":
      return "Successor coverage exists";
    case "limited_development_upside":
      return "Limited development upside";
    default:
      return "Strategic asset signal";
  }
}

function financialStrengthLabel(strength: ClubFinancialAssessment["strengths"][number]): string {
  switch (strength.type) {
    case "strong_cash_buffer":
      return "Strong cash buffer relative to known payroll";
    case "healthy_liquidity":
      return "Healthy liquidity share";
    case "strong_development_value_pipeline":
      return "Strong development value pipeline";
    case "well_diversified_squad_assets":
      return "Squad assets are reasonably diversified";
  }
}

function financialWarningLabel(warning: ClubFinancialAssessment["warnings"][number]): string {
  switch (warning.type) {
    case "low_known_payroll_coverage":
      return `Known payroll coverage is low (${weeks(warning.weeks)})`;
    case "low_liquidity":
      return `Liquidity is low (${percentage(warning.ratio)})`;
    case "high_asset_concentration":
      return `Top ${warning.topPlayers} players concentrate ${percentage(warning.share)} of squad value`;
    case "incomplete_market_value_coverage":
      return `Market valuation covers ${percentage(warning.coverage)} of the squad`;
    case "incomplete_projection_coverage":
      return `Development projections cover ${percentage(warning.coverage)} of the squad`;
    case "missing_payroll_data":
      return "Known payroll data is incomplete";
  }
}

function fundingStatus(item: CapitalAllocationItem | undefined): string {
  if (!item) return "Unknown";
  if (item.coverage === "not_cash_dependent") return "Not cash dependent";
  if (item.timing === "medium_term" && item.coverage === "unfunded") return "Future need";
  return titleCase(item.coverage.replaceAll("_", " "));
}

function timingLabel(item: CapitalAllocationItem): string {
  if (item.timing === "now") return "Current";
  if (item.timing === "next_season") return "Next season";
  return "Medium term";
}

function conflictDescription(type: string): string {
  switch (type) {
    case "monetize_vs_develop":
      return "Monetization candidate conflicts with development value.";
    case "monetize_vs_squad_need":
      return "Monetization candidate conflicts with a squad need.";
    case "investment_vs_cash_preservation":
      return "Investment conflicts with cash preservation.";
    default:
      return "Strategic recommendations are in conflict.";
  }
}

function profileLabel(profile: string): string {
  return profile
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function roleLabel(role: string): string {
  return titleCase(role.replaceAll("_", " "));
}

function horizonLabel(horizon: string): string {
  if (horizon === "next_season") return "Next season";
  if (horizon === "medium_term") return "Medium term";
  return "Current";
}

function financialStatusLabel(status: FinancialPositionStatus): string {
  return titleCase(status);
}

function money(value: number | null | undefined, currency: string | null): string {
  return formatMoney(
    value === null || value === undefined ? null : { amount: value, currency, isComplete: true }
  );
}

function signedMoney(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${money(Math.abs(value), currency)}`;
}

function moneyRange(range: { low: number; high: number }, currency: string | null): string {
  return `${money(range.low, currency)} – ${money(range.high, currency)}`;
}

function weeks(value: number | null): string {
  return value === null
    ? "—"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} weeks`;
}

function percentage(value: number | null): string {
  return value === null
    ? "—"
    : `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function profileDepthStatusLabel(status: ProfileDepthStatus): string {
  return titleCase(status);
}


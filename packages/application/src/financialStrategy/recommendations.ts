import {
  buildCapitalAllocationPlan,
  buildFinancialStrategyRecommendations,
  buildLiquidityScenario,
  type CapitalAllocationPlan,
  type ClubFinancialAssessment,
  type FinancialStrategyPlan,
  type LiquidityScenario
} from "@atlas/domain";
import { getCapitalAllocationContext } from "./capital-allocation.js";
import type { ClubId } from "../types.js";

export async function getFinancialStrategyAssessment(clubId: ClubId): Promise<{
  financialAssessment: ClubFinancialAssessment;
  capitalAllocation: CapitalAllocationPlan;
  strategyPlan: FinancialStrategyPlan;
}> {
  const allocationContext = await getCapitalAllocationContext(clubId);
  const capitalAllocation = buildCapitalAllocationPlan(allocationContext);
  return {
    financialAssessment: allocationContext.financialAssessment,
    capitalAllocation,
    strategyPlan: buildFinancialStrategyRecommendations({
      ...allocationContext,
      allocation: capitalAllocation
    })
  };
}

export async function getFinancialStrategyPlan(clubId: ClubId): Promise<FinancialStrategyPlan> {
  const allocationContext = await getCapitalAllocationContext(clubId);
  const allocation = buildCapitalAllocationPlan(allocationContext);
  return buildFinancialStrategyRecommendations({ ...allocationContext, allocation });
}

export async function getFinancialLiquidityScenario(
  clubId: ClubId,
  playerIds: readonly number[]
): Promise<LiquidityScenario> {
  const allocationContext = await getCapitalAllocationContext(clubId);
  const allocation = buildCapitalAllocationPlan(allocationContext);
  return buildLiquidityScenario({ ...allocationContext, allocation }, playerIds);
}

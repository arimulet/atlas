import {
  buildCapitalAllocationPlan,
  buildFinancialStrategyRecommendations,
  buildLiquidityScenario,
  type FinancialStrategyPlan,
  type LiquidityScenario
} from "@atlas/domain";
import { getCapitalAllocationContext } from "./capital-allocation.js";
import type { ClubId } from "../types.js";

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

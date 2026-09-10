import {
  assessInvestmentSafety,
  buildCapitalAllocationPlan,
  type CapitalAllocationContext,
  type CapitalAllocationPlan,
  type InvestmentSafetyAssessment,
  type PlayerMarketValueEstimate,
  analyzeSquadDepth,
  generateSquadPlanningRecommendations
} from "@atlas/domain";
import { getClubFinancialAssessment } from "./index.js";
import { getSquadAssessment } from "../squadPlanning/index.js";
import type { SquadAssessmentData } from "../squadPlanning/types.js";
import type { ClubId } from "../types.js";

export async function getCapitalAllocationPlan(clubId: ClubId): Promise<CapitalAllocationPlan> {
  const context = await getCapitalAllocationContext(clubId);
  return buildCapitalAllocationPlan(context);
}

export async function getInvestmentSafety(
  clubId: ClubId,
  amount: number
): Promise<InvestmentSafetyAssessment> {
  const financialAssessment = await getClubFinancialAssessment(clubId);
  return assessInvestmentSafety(financialAssessment, amount);
}

export async function getCapitalAllocationContext(
  clubId: ClubId
): Promise<CapitalAllocationContext> {
  const [financialAssessment, squadAssessment] = await Promise.all([
    getClubFinancialAssessment(clubId),
    getSquadAssessment(clubId)
  ]);
  const depthAnalysis = analyzeSquadDepth(squadAssessment.depthPlayers, {
    currentGameWeek: squadAssessment.currentGameWeek
  });
  const squadPlanning = generateSquadPlanningRecommendations({
    depthAnalysis,
    players: squadAssessment.depthPlayers
  });
  return {
    financialAssessment,
    squadPlanning,
    depthAnalysis,
    playerMarketValues: buildPlayerMarketValues(squadAssessment),
    marketProjections: squadAssessment.depthPlayers
      .map((player) => player.marketProjection)
      .filter((projection): projection is NonNullable<typeof projection> => projection !== null),
    squadPlayers: squadAssessment.depthPlayers,
    playerProfiles: squadAssessment.depthPlayers.map((player) => ({
      playerId: player.playerId,
      profile: player.profile
    }))
  };
}

function buildPlayerMarketValues(assessment: SquadAssessmentData): PlayerMarketValueEstimate[] {
  return assessment.depthPlayers
    .map((player) => player.marketValue)
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .map((value) => ({
      ...value.fundamental,
      estimatedValue: value.calibratedValue,
      estimatedMarketValue: value.calibratedValue,
      confidence: value.confidence,
      reasons: value.reasons
    }));
}

import {
  assessInvestmentSafety,
  buildCapitalAllocationPlan,
  inferPositionFromSkills,
  simulatePlayerAcquisition,
  type CapitalAllocationContext,
  type CapitalAllocationPlan,
  type InvestmentSafetyAssessment,
  type PlayerAcquisitionSimulationInput,
  type PlayerAcquisitionSimulationResult,
  type PlayerMarketValueEstimate,
  type PlayerTransferRecord,
  type DevelopmentProfile,
  analyzeSquadDepth,
  generateSquadPlanningRecommendations
} from "@atlas/domain";
import {
  findFinalMarketTransfersUpToDate,
  type PersistedMarketTransfer,
  PlayerModel,
  MarketTransferCurrentModel,
  MarketTransferModel
} from "@atlas/database";
import { getClubFinancialAssessment } from "./index.js";
import { getSquadAssessment } from "../squadPlanning/index.js";
import { getTrainingPageData } from "../training/index.js";
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

export async function simulatePlayerAcquisitionApplication(
  clubId: ClubId,
  input: PlayerAcquisitionSimulationInput
): Promise<PlayerAcquisitionSimulationResult> {
  const [context, training, transfers] = await Promise.all([
    getCapitalAllocationContext(clubId),
    getTrainingPageData(clubId).catch(() => null),
    findFinalMarketTransfersUpToDate(new Date(), 50).catch(() => [])
  ]);

  let enrichedInput: PlayerAcquisitionSimulationInput = { ...input };

  // If playerId is provided and skills/age are missing, lookup from database
  if (input.playerId && (!input.skills || Object.keys(input.skills).length === 0)) {
    const playerId = input.playerId;
    const [playerDoc, currentTransferDoc, histTransferDoc] = await Promise.all([
      PlayerModel.findOne({ playerId }).lean().catch(() => null),
      MarketTransferCurrentModel.findOne({ playerId }).lean().catch(() => null),
      MarketTransferModel.findOne({ playerId }).sort({ transferDate: -1 }).lean().catch(() => null)
    ]);

    const resolvedSkills = ((playerDoc?.skills ?? currentTransferDoc?.player.skills ?? histTransferDoc?.skills ?? {}) as Record<string, number>);
    const resolvedAge = playerDoc?.age ?? currentTransferDoc?.player.age ?? histTransferDoc?.age ?? input.age ?? null;
    const resolvedName = playerDoc?.name ?? currentTransferDoc?.player.name ?? histTransferDoc?.name ?? input.name ?? null;
    const resolvedWage = playerDoc?.wage ?? input.weeklyWage ?? null;
    let resolvedPosition = playerDoc?.position ?? input.position ?? null;

    if (!resolvedPosition && Object.keys(resolvedSkills).length > 0) {
      resolvedPosition = inferPositionFromSkills(resolvedSkills);
    }

    enrichedInput = {
      ...input,
      name: resolvedName,
      age: resolvedAge,
      skills: resolvedSkills,
      position: resolvedPosition,
      weeklyWage: resolvedWage
    };
  }

  const activeAdvancedTraineeCount =
    training?.players?.filter((p) => p.training?.advanced === true).length ?? 0;

  return simulatePlayerAcquisition(
    {
      financialAssessment: context.financialAssessment,
      squadDepth: context.depthAnalysis,
      squadPlanning: context.squadPlanning,
      squadPlayers: context.squadPlayers,
      trainingConfiguration: training?.configuration ?? null,
      activeAdvancedTraineeCount,
      marketTransfers: transfers.map(mapPersistedToTransferRecord)
    },
    enrichedInput
  );
}

function mapPersistedToTransferRecord(transfer: PersistedMarketTransfer): PlayerTransferRecord {
  return {
    transferId: transfer.transferKey,
    playerId: transfer.playerId,
    transferDate: transfer.transferDate,
    gameWeek: transfer.gameWeek,
    salePrice: transfer.salePrice,
    age: transfer.age,
    skills: {
      stamina: transfer.skills.stamina ?? null,
      pace: transfer.skills.pace ?? null,
      technique: transfer.skills.technique ?? null,
      passing: transfer.skills.passing ?? null,
      keeper: transfer.skills.keeper ?? null,
      defender: (transfer.skills as Record<string, number | undefined>).defending ?? (transfer.skills as Record<string, number | undefined>).defender ?? null,
      playmaker: (transfer.skills as Record<string, number | undefined>).playmaking ?? (transfer.skills as Record<string, number | undefined>).playmaker ?? null,
      striker: transfer.skills.striker ?? null
    },
    developmentProfile: (transfer.profile as DevelopmentProfile | null) ?? null,
    source: "imported",
    salePriceType: "final_sale",
    dataQuality: "complete"
  };
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

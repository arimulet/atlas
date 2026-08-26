import { MongoClubRepository, MongoSnapshotRepository } from "@atlas/database";
import {
  assessClubFinancialPosition,
  buildClubFinancialPosition,
  type ClubFinancialAssessment,
  type ClubFinancialPosition,
  type FinancialPositionContext,
  type PlayerMarketValueEstimate,
  type SquadMarketValueAssessment,
  type SquadMarketValueRankingEntry
} from "@atlas/domain";
import { getSquadAssessment } from "../squadPlanning/index.js";
import type { SquadAssessmentData } from "../squadPlanning/types.js";
import type { ClubId } from "../types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function getClubFinancialAssessment(clubId: ClubId): Promise<ClubFinancialAssessment> {
  const context = await getClubFinancialContext(clubId);
  return assessClubFinancialPosition(context);
}

export async function getClubFinancialPosition(clubId: ClubId): Promise<ClubFinancialPosition> {
  const context = await getClubFinancialContext(clubId);
  return buildClubFinancialPosition(context);
}

export async function getClubFinancialContext(clubId: ClubId): Promise<FinancialPositionContext> {
  const club = await clubRepository.findById(clubId.toString());
  if (!club) throw new Error(`Club not found: ${clubId}`);

  const [snapshots, squadAssessment] = await Promise.all([
    snapshotRepository.listByClub(clubId),
    getSquadAssessment(clubId)
  ]);
  const latest = snapshots.at(-1);
  const roleByPlayer = new Map(
    squadAssessment.players.map((player) => [player.playerId, player.role] as const)
  );

  return {
    club: { budget: club.budget, currency: club.currency },
    players: (latest?.players ?? []).map((player) => ({
      playerId: player.playerId,
      wage: player.wage,
      active: true,
      squadRole: roleByPlayer.get(player.playerId) ?? null
    })),
    trainers: club.staff.map((trainer) => ({
      trainerId: trainer.trainerId,
      salary: trainer.salary,
      active: trainer.active,
      contracted: trainer.contracted
    })),
    squadMarketValue: buildSquadMarketValueAssessment(squadAssessment),
    squadAssessment,
    marketProjections: squadAssessment.depthPlayers
      .map((player) => player.marketProjection)
      .filter((projection): projection is NonNullable<typeof projection> => projection !== null),
    squadPlayerCount: latest?.players.length ?? 0
  };
}

function buildSquadMarketValueAssessment(
  assessment: SquadAssessmentData
): SquadMarketValueAssessment | null {
  const players = assessment.depthPlayers
    .map((player) => player.marketValue)
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .map((value) => toMarketValueEstimate(value));
  if (players.length === 0) return null;

  const ranking: SquadMarketValueRankingEntry[] = [...players]
    .sort(
      (left, right) =>
        right.estimatedValue.expected - left.estimatedValue.expected ||
        left.playerId - right.playerId
    )
    .map((player, index) => ({
      playerId: player.playerId,
      expectedValue: player.estimatedValue.expected,
      rank: index + 1
    }));
  const values = players.map((player) => player.estimatedValue.expected);
  const totalEstimatedValue = values.reduce((total, value) => total + value, 0);

  return {
    players,
    ranking,
    totalEstimatedValue,
    averageEstimatedValue: values.length > 0 ? totalEstimatedValue / values.length : 0,
    medianEstimatedValue: median(values),
    mostValuablePlayerIds:
      ranking.length > 0 && ranking[0] !== undefined
        ? ranking
            .filter((entry) => entry.expectedValue === ranking[0]!.expectedValue)
            .map((entry) => entry.playerId)
        : []
  };
}

function toMarketValueEstimate(
  value: NonNullable<SquadAssessmentData["depthPlayers"][number]["marketValue"]>
): PlayerMarketValueEstimate {
  return {
    ...value.fundamental,
    estimatedValue: value.calibratedValue,
    estimatedMarketValue: value.calibratedValue
  };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
    : (ordered[middle] ?? 0);
}

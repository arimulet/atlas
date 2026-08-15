import { SUPPORTED_SKILLS } from "./constants.js";
import type { Money, SkillKey, SkillSet } from "./types.js";

export interface SnapshotComparisonPlayer {
  id: string;
  playerId: number | null;
  name: string;
  age: number;
  wage: Money;
  value: Money;
  skills: Required<SkillSet>;
}

export interface SnapshotComparisonSnapshot {
  id: string;
  clubId: string;
  snapshotDate: string;
  players: SnapshotComparisonPlayer[];
}

export interface NumericChange {
  before: number;
  after: number;
  delta: number;
}

export interface MoneyChange extends NumericChange {
  currency: string | null;
  isComparable: boolean;
}

export interface SkillChange extends NumericChange {
  skill: SkillKey;
}

export interface MatchedPlayerComparison {
  status: "matched";
  identity: {
    playerId: number;
  };
  basePlayer: SnapshotComparisonPlayer;
  targetPlayer: SnapshotComparisonPlayer;
  changes: {
    age: NumericChange | null;
    wage: MoneyChange | null;
    value: MoneyChange | null;
    skills: SkillChange[];
  };
}

export interface SnapshotComparisonAmbiguousPlayer {
  snapshot: "base" | "target";
  player: SnapshotComparisonPlayer;
  reason: "missing-stable-identity" | "duplicate-stable-identity";
}

export interface SnapshotComparisonSummary {
  playerCountBefore: number;
  playerCountAfter: number;
  totalValueBefore: number;
  totalValueAfter: number;
  totalValueDelta: number;
  totalWageBefore: number;
  totalWageAfter: number;
  totalWageDelta: number;
  additionsCount: number;
  departuresCount: number;
  ambiguousPlayersCount: number;
}

export interface SnapshotComparison {
  clubId: string;
  baseSnapshotId: string;
  targetSnapshotId: string;
  baseSnapshotDate: string;
  targetSnapshotDate: string;
  matchedPlayers: MatchedPlayerComparison[];
  newPlayers: SnapshotComparisonPlayer[];
  absentPlayers: SnapshotComparisonPlayer[];
  ambiguousPlayers: SnapshotComparisonAmbiguousPlayer[];
  summary: SnapshotComparisonSummary;
}

export function compareSnapshots(
  baseSnapshot: SnapshotComparisonSnapshot,
  targetSnapshot: SnapshotComparisonSnapshot
): SnapshotComparison {
  if (baseSnapshot.clubId !== targetSnapshot.clubId) {
    throw new Error("Snapshots must belong to the same club.");
  }

  const baseIndex = indexByStableIdentity(baseSnapshot.players);
  const targetIndex = indexByStableIdentity(targetSnapshot.players);
  const ambiguousPlayers: SnapshotComparisonAmbiguousPlayer[] = [
    ...baseIndex.ambiguous.map((player) => ({ snapshot: "base" as const, ...player })),
    ...targetIndex.ambiguous.map((player) => ({ snapshot: "target" as const, ...player }))
  ];

  const matchedPlayers: MatchedPlayerComparison[] = [];
  const absentPlayers: SnapshotComparisonPlayer[] = [];
  const newPlayers: SnapshotComparisonPlayer[] = [];
  const matchedTargetPlayerIds = new Set<number>();

  for (const [playerId, basePlayer] of baseIndex.matchable) {
    const targetPlayer = targetIndex.matchable.get(playerId);

    if (!targetPlayer) {
      absentPlayers.push(basePlayer);
      continue;
    }

    matchedTargetPlayerIds.add(playerId);
    matchedPlayers.push(comparePlayer(playerId, basePlayer, targetPlayer));
  }

  for (const [playerId, targetPlayer] of targetIndex.matchable) {
    if (!matchedTargetPlayerIds.has(playerId)) {
      newPlayers.push(targetPlayer);
    }
  }

  return {
    clubId: baseSnapshot.clubId,
    baseSnapshotId: baseSnapshot.id,
    targetSnapshotId: targetSnapshot.id,
    baseSnapshotDate: baseSnapshot.snapshotDate,
    targetSnapshotDate: targetSnapshot.snapshotDate,
    matchedPlayers,
    newPlayers,
    absentPlayers,
    ambiguousPlayers,
    summary: {
      playerCountBefore: baseSnapshot.players.length,
      playerCountAfter: targetSnapshot.players.length,
      totalValueBefore: sumMoney(baseSnapshot.players, "value"),
      totalValueAfter: sumMoney(targetSnapshot.players, "value"),
      totalValueDelta:
        sumMoney(targetSnapshot.players, "value") -
        sumMoney(baseSnapshot.players, "value"),
      totalWageBefore: sumMoney(baseSnapshot.players, "wage"),
      totalWageAfter: sumMoney(targetSnapshot.players, "wage"),
      totalWageDelta:
        sumMoney(targetSnapshot.players, "wage") - sumMoney(baseSnapshot.players, "wage"),
      additionsCount: newPlayers.length,
      departuresCount: absentPlayers.length,
      ambiguousPlayersCount: ambiguousPlayers.length
    }
  };
}

function indexByStableIdentity(players: SnapshotComparisonPlayer[]): {
  matchable: Map<number, SnapshotComparisonPlayer>;
  ambiguous: Array<{
    player: SnapshotComparisonPlayer;
    reason: SnapshotComparisonAmbiguousPlayer["reason"];
  }>;
} {
  const byPlayerId = new Map<number, SnapshotComparisonPlayer[]>();
  const ambiguous: Array<{
    player: SnapshotComparisonPlayer;
    reason: SnapshotComparisonAmbiguousPlayer["reason"];
  }> = [];

  for (const player of players) {
    if (!player.playerId) {
      ambiguous.push({ player, reason: "missing-stable-identity" });
      continue;
    }

    byPlayerId.set(player.playerId, [...(byPlayerId.get(player.playerId) ?? []), player]);
  }

  const matchable = new Map<number, SnapshotComparisonPlayer>();

  for (const [playerId, playersWithIdentity] of byPlayerId) {
    if (playersWithIdentity.length === 1) {
      matchable.set(playerId, playersWithIdentity[0]!);
      continue;
    }

    ambiguous.push(
      ...playersWithIdentity.map((player) => ({
        player,
        reason: "duplicate-stable-identity" as const
      }))
    );
  }

  return { matchable, ambiguous };
}

function comparePlayer(
  playerId: number,
  basePlayer: SnapshotComparisonPlayer,
  targetPlayer: SnapshotComparisonPlayer
): MatchedPlayerComparison {
  return {
    status: "matched",
    identity: { playerId },
    basePlayer,
    targetPlayer,
    changes: {
      age: numericChange(basePlayer.age, targetPlayer.age),
      wage: moneyChange(basePlayer.wage, targetPlayer.wage),
      value: moneyChange(basePlayer.value, targetPlayer.value),
      skills: SUPPORTED_SKILLS
        .map((skill) => {
          const before = basePlayer.skills[skill];
          const after = targetPlayer.skills[skill];

          if (before === null || after === null || before === after) {
            return null;
          }

          return { skill, before, after, delta: after - before };
        })
        .filter((change): change is SkillChange => change !== null)
    }
  };
}

function numericChange(before: number, after: number): NumericChange | null {
  return before === after ? null : { before, after, delta: after - before };
}

function moneyChange(before: Money, after: Money): MoneyChange | null {
  if (before.amount === after.amount) {
    return null;
  }

  return {
    before: before.amount,
    after: after.amount,
    delta: after.amount - before.amount,
    currency: before.currency === after.currency ? before.currency : null,
    isComparable: true
  };
}

function sumMoney(players: SnapshotComparisonPlayer[], field: "value" | "wage"): number {
  return players.reduce((total, player) => total + player[field].amount, 0);
}

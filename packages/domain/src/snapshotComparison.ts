import type { Money, SkillSet } from "./index.js";

export interface SnapshotComparisonPlayer {
  id: string;
  playerId: string | null;
  externalId: string | null;
  name: string;
  age: number;
  wage: Money;
  estimatedValue: Money;
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
  skill: keyof Required<SkillSet>;
}

export interface MatchedPlayerComparison {
  status: "matched";
  identity: {
    externalId: string;
  };
  basePlayer: SnapshotComparisonPlayer;
  targetPlayer: SnapshotComparisonPlayer;
  changes: {
    age: NumericChange | null;
    wage: MoneyChange | null;
    estimatedValue: MoneyChange | null;
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
  totalEstimatedValueBefore: number;
  totalEstimatedValueAfter: number;
  totalEstimatedValueDelta: number;
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

const skillKeys = [
  "stamina",
  "pace",
  "technique",
  "passing",
  "keeper",
  "defender",
  "playmaker",
  "striker"
] as const;

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
  const matchedTargetExternalIds = new Set<string>();

  for (const [externalId, basePlayer] of baseIndex.matchable) {
    const targetPlayer = targetIndex.matchable.get(externalId);

    if (!targetPlayer) {
      absentPlayers.push(basePlayer);
      continue;
    }

    matchedTargetExternalIds.add(externalId);
    matchedPlayers.push(comparePlayer(externalId, basePlayer, targetPlayer));
  }

  for (const [externalId, targetPlayer] of targetIndex.matchable) {
    if (!matchedTargetExternalIds.has(externalId)) {
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
      totalEstimatedValueBefore: sumMoney(baseSnapshot.players, "estimatedValue"),
      totalEstimatedValueAfter: sumMoney(targetSnapshot.players, "estimatedValue"),
      totalEstimatedValueDelta:
        sumMoney(targetSnapshot.players, "estimatedValue") -
        sumMoney(baseSnapshot.players, "estimatedValue"),
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
  matchable: Map<string, SnapshotComparisonPlayer>;
  ambiguous: Array<{
    player: SnapshotComparisonPlayer;
    reason: SnapshotComparisonAmbiguousPlayer["reason"];
  }>;
} {
  const byExternalId = new Map<string, SnapshotComparisonPlayer[]>();
  const ambiguous: Array<{
    player: SnapshotComparisonPlayer;
    reason: SnapshotComparisonAmbiguousPlayer["reason"];
  }> = [];

  for (const player of players) {
    if (!player.externalId) {
      ambiguous.push({ player, reason: "missing-stable-identity" });
      continue;
    }

    byExternalId.set(player.externalId, [...(byExternalId.get(player.externalId) ?? []), player]);
  }

  const matchable = new Map<string, SnapshotComparisonPlayer>();

  for (const [externalId, playersWithIdentity] of byExternalId) {
    if (playersWithIdentity.length === 1) {
      matchable.set(externalId, playersWithIdentity[0]!);
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
  externalId: string,
  basePlayer: SnapshotComparisonPlayer,
  targetPlayer: SnapshotComparisonPlayer
): MatchedPlayerComparison {
  return {
    status: "matched",
    identity: { externalId },
    basePlayer,
    targetPlayer,
    changes: {
      age: numericChange(basePlayer.age, targetPlayer.age),
      wage: moneyChange(basePlayer.wage, targetPlayer.wage),
      estimatedValue: moneyChange(basePlayer.estimatedValue, targetPlayer.estimatedValue),
      skills: skillKeys
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
  if (before.amount === after.amount && before.currency === after.currency) {
    return null;
  }

  return {
    before: before.amount,
    after: after.amount,
    delta: after.amount - before.amount,
    currency: before.currency === after.currency ? before.currency : null,
    isComparable: before.currency !== null && before.currency === after.currency
  };
}

function sumMoney(players: SnapshotComparisonPlayer[], field: "estimatedValue" | "wage"): number {
  return players.reduce((total, player) => total + player[field].amount, 0);
}

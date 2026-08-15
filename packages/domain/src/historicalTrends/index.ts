import { SUPPORTED_SKILLS } from "../constants.js";
import type { Money, SkillKey } from "../types.js";
import type {
  SnapshotComparisonPlayer,
  SnapshotComparisonSnapshot
} from "../snapshotComparison.js";
import type {
  HistoricalTrendPoint,
  HistoricalTrends,
  MoneyTrend,
  NumericTrend,
  PlayerHistoricalTrend,
  SkillTrend,
  SquadHistoricalTrendSummary,
  TrendDirection,
  TrendSnapshotEvidence
} from "./types.js";

export type {
  HistoricalTrends,
  MoneyTrend,
  NumericTrend,
  PlayerHistoricalTrend,
  SkillTrend,
  SquadHistoricalTrendSummary,
  TrendDirection,
  TrendEvidence,
  TrendSnapshotEvidence
} from "./types.js";

export function calculateHistoricalTrends(
  snapshots: SnapshotComparisonSnapshot[]
): HistoricalTrends {
  if (snapshots.length === 0) {
    throw new Error("At least one snapshot is required to calculate historical trends.");
  }

  const orderedSnapshots = [...snapshots].sort((left, right) =>
    left.snapshotDate.localeCompare(right.snapshotDate)
  );
  const clubId = orderedSnapshots[0]!.clubId;

  if (orderedSnapshots.some((snapshot) => snapshot.clubId !== clubId)) {
    throw new Error("Snapshots must belong to the same club.");
  }

  const snapshotWarnings = collectSnapshotWarnings(orderedSnapshots);
  const players = buildPlayerTrends(orderedSnapshots);
  const squad = buildSquadTrendSummary(orderedSnapshots, players, snapshotWarnings);

  return {
    clubId,
    snapshotIds: orderedSnapshots.map((snapshot) => snapshot.id),
    snapshotDates: orderedSnapshots.map((snapshot) => snapshot.snapshotDate),
    players,
    squad,
    warnings: snapshots.length < 2 ? ["At least two snapshots are required for trends."] : []
  };
}

function buildPlayerTrends(snapshots: SnapshotComparisonSnapshot[]): PlayerHistoricalTrend[] {
  const byPlayerId = new Map<number, HistoricalTrendPoint[]>();

  for (const snapshot of snapshots) {
    const index = indexSnapshotPlayers(snapshot.players);

    for (const [playerId, player] of index.matchable) {
      byPlayerId.set(playerId, [...(byPlayerId.get(playerId) ?? []), { snapshot, player }]);
    }
  }

  return [...byPlayerId.entries()]
    .sort(([left], [right]) => left - right)
    .map(([playerId, points]) => {
      const orderedPoints = points.sort((left, right) =>
        left.snapshot.snapshotDate.localeCompare(right.snapshot.snapshotDate)
      );
      const finalPoint = orderedPoints.at(-1);

      return {
        identity: { playerId },
        playerName: finalPoint?.player.name ?? orderedPoints[0]!.player.name,
        value: moneyTrend(orderedPoints, "value"),
        wage: moneyTrend(orderedPoints, "wage"),
        skills: SUPPORTED_SKILLS.map((skill) => skillTrend(orderedPoints, skill)),
        warnings:
          orderedPoints.length < 2
            ? ["Player needs at least two comparable snapshots for trend calculation."]
            : []
      };
    });
}

function buildSquadTrendSummary(
  snapshots: SnapshotComparisonSnapshot[],
  players: PlayerHistoricalTrend[],
  snapshotWarnings: string[]
): SquadHistoricalTrendSummary {
  const totalValuePoints = snapshots.map((snapshot) => ({
    snapshot,
    value: sumMoney(snapshot.players, "value"),
    currency: commonCurrency(snapshot.players.map((player) => player.value))
  }));
  const totalWagePoints = snapshots.map((snapshot) => ({
    snapshot,
    value: sumMoney(snapshot.players, "wage"),
    currency: commonCurrency(snapshot.players.map((player) => player.wage))
  }));
  const playerCountPoints = snapshots.map((snapshot) => ({
    snapshot,
    value: snapshot.players.length
  }));

  return {
    valueTotal: aggregateMoneyTrend(totalValuePoints),
    wageTotal: aggregateMoneyTrend(totalWagePoints),
    playerCount: numericTrend(playerCountPoints),
    mainVariations: mainVariations(players),
    warnings: snapshotWarnings
  };
}

function moneyTrend(points: HistoricalTrendPoint[], field: "value" | "wage"): MoneyTrend {
  return moneyTrendFromValues(
    points.map((point) => ({
      snapshot: point.snapshot,
      value: point.player[field].amount,
      currency: point.player[field].currency
    }))
  );
}

function aggregateMoneyTrend(
  points: Array<{ snapshot: SnapshotComparisonSnapshot; value: number; currency: string | null }>
): MoneyTrend {
  return moneyTrendFromValues(points);
}

function moneyTrendFromValues(
  points: Array<{ snapshot: SnapshotComparisonSnapshot; value: number; currency: string | null }>
): MoneyTrend {
  return {
    ...numericTrend(
      points.map((point) => ({ snapshot: point.snapshot, value: point.value })),
      []
    ),
    currency: commonCurrency(
      points.map((point) => ({ amount: point.value, currency: point.currency }))
    ),
    isComparable: true
  };
}

function skillTrend(
  points: HistoricalTrendPoint[],
  skill: SkillKey
): SkillTrend {
  const comparablePoints = points
    .map((point) => ({ snapshot: point.snapshot, value: point.player.skills[skill] }))
    .filter(
      (point): point is { snapshot: SnapshotComparisonSnapshot; value: number } =>
        point.value !== null
    );

  return {
    skill,
    ...numericTrend(
      comparablePoints,
      comparablePoints.length < points.length
        ? [`Skill ${skill} is missing in one or more snapshots.`]
        : []
    )
  };
}

function numericTrend(
  points: Array<{ snapshot: SnapshotComparisonSnapshot; value: number }>,
  warnings: string[] = []
): NumericTrend {
  if (points.length < 2) {
    return {
      direction: "insufficient_data",
      evidence: {
        initialSnapshot: points[0] ? evidencePoint(points[0]) : null,
        finalSnapshot: points.at(-1) ? evidencePoint(points.at(-1)!) : null,
        deltaAbsolute: null,
        deltaPercentage: null,
        dataPoints: points.length,
        warnings: ["At least two data points are required.", ...warnings]
      }
    };
  }

  const initial = points[0]!;
  const final = points.at(-1)!;
  const delta = final.value - initial.value;

  return {
    direction: classifyDelta(delta),
    evidence: {
      initialSnapshot: evidencePoint(initial),
      finalSnapshot: evidencePoint(final),
      deltaAbsolute: delta,
      deltaPercentage: initial.value === 0 ? null : (delta / initial.value) * 100,
      dataPoints: points.length,
      warnings
    }
  };
}

function evidencePoint(point: {
  snapshot: SnapshotComparisonSnapshot;
  value: number;
}): TrendSnapshotEvidence {
  return {
    snapshotId: point.snapshot.id,
    snapshotDate: point.snapshot.snapshotDate,
    value: point.value
  };
}

function classifyDelta(delta: number): TrendDirection {
  if (delta > 0) {
    return "up";
  }

  if (delta < 0) {
    return "down";
  }

  return "stable";
}

function mainVariations(
  players: PlayerHistoricalTrend[]
): SquadHistoricalTrendSummary["mainVariations"] {
  return players
    .flatMap((player) => [
      variation(player, "value", player.value),
      variation(player, "wage", player.wage)
    ])
    .filter(
      (entry): entry is SquadHistoricalTrendSummary["mainVariations"][number] => entry !== null
    )
    .sort((left, right) => Math.abs(right.deltaAbsolute) - Math.abs(left.deltaAbsolute))
    .slice(0, 5);
}

function variation(
  player: PlayerHistoricalTrend,
  metric: "value" | "wage",
  trend: MoneyTrend
): SquadHistoricalTrendSummary["mainVariations"][number] | null {
  if (trend.direction !== "up" && trend.direction !== "down") {
    return null;
  }

  return {
    playerId: player.identity.playerId,
    playerName: player.playerName,
    metric,
    deltaAbsolute: trend.evidence.deltaAbsolute ?? 0,
    deltaPercentage: trend.evidence.deltaPercentage,
    direction: trend.direction
  };
}

function collectSnapshotWarnings(snapshots: SnapshotComparisonSnapshot[]): string[] {
  return snapshots.flatMap((snapshot) => {
    const index = indexSnapshotPlayers(snapshot.players);

    return index.ambiguous.map(
      (entry) =>
        `Snapshot ${snapshot.id} player ${entry.player.name} is excluded from player trends: ${entry.reason}.`
    );
  });
}

function indexSnapshotPlayers(players: SnapshotComparisonPlayer[]): {
  matchable: Map<number, SnapshotComparisonPlayer>;
  ambiguous: Array<{
    player: SnapshotComparisonPlayer;
    reason: "missing-stable-identity" | "duplicate-stable-identity";
  }>;
} {
  const byPlayerId = new Map<number, SnapshotComparisonPlayer[]>();
  const ambiguous: Array<{
    player: SnapshotComparisonPlayer;
    reason: "missing-stable-identity" | "duplicate-stable-identity";
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

function sumMoney(players: SnapshotComparisonPlayer[], field: "value" | "wage"): number {
  return players.reduce((total, player) => total + player[field].amount, 0);
}

function commonCurrency(values: Money[]): string | null {
  const currencies = new Set(values.map((value) => value.currency).filter(Boolean));
  return currencies.size === 1 ? [...currencies][0]! : null;
}

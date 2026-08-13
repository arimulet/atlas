import { SUPPORED_SKILLS } from "./constants.js";
import type { Confidence, EvidenceKind, Severity, SkillSet } from "./types.js";
import {
  calculateHistoricalTrends,
  type HistoricalTrends,
  type PlayerHistoricalTrend
} from "./historicalTrends.js";
import type { SnapshotComparisonPlayer, SnapshotComparisonSnapshot } from "./snapshotComparison.js";

export type HistoricalFindingType =
  | "player_sustained_asset_appreciation"
  | "player_asset_or_sporting_deterioration"
  | "player_stagnation"
  | "risky_wage_against_historical_evolution"
  | "squad_asset_evolution";

export interface HistoricalFindingEvidence {
  kind: EvidenceKind;
  metric: string;
  description: string;
  value?: number | string | null;
}

export interface HistoricalFinding {
  type: HistoricalFindingType;
  severity: Severity;
  confidence: Confidence;
  subject:
    | {
        kind: "player";
        playerId: number;
        playerName: string;
      }
    | {
        kind: "squad";
        clubId: string;
      };
  evidence: HistoricalFindingEvidence[];
  period: {
    fromSnapshotId: string;
    toSnapshotId: string;
    fromDate: string;
    toDate: string;
    dataPoints: number;
  };
  actionSuggested: string;
}

export interface HistoricalFindings {
  clubId: string;
  snapshotIds: string[];
  snapshotDates: string[];
  taxonomy: HistoricalFindingType[];
  findings: HistoricalFinding[];
  warnings: string[];
}

const taxonomy: HistoricalFindingType[] = [
  "player_sustained_asset_appreciation",
  "player_asset_or_sporting_deterioration",
  "player_stagnation",
  "risky_wage_against_historical_evolution",
  "squad_asset_evolution"
];

export function generateHistoricalFindings(
  snapshots: SnapshotComparisonSnapshot[]
): HistoricalFindings {
  const trends = calculateHistoricalTrends(snapshots);
  const orderedSnapshots = [...snapshots].sort((left, right) =>
    left.snapshotDate.localeCompare(right.snapshotDate)
  );
  const period = analysisPeriod(orderedSnapshots);

  if (orderedSnapshots.length < 2) {
    return {
      clubId: trends.clubId,
      snapshotIds: trends.snapshotIds,
      snapshotDates: trends.snapshotDates,
      taxonomy,
      findings: [],
      warnings: ["At least two snapshots are required for historical findings.", ...trends.warnings]
    };
  }

  const playerSeries = buildPlayerSeries(orderedSnapshots);
  const findings = trends.players.flatMap((trend) =>
    generatePlayerFindings(trend, playerSeries.get(trend.identity.playerId) ?? [], period)
  );
  const squadFinding = generateSquadFinding(trends, period);

  return {
    clubId: trends.clubId,
    snapshotIds: trends.snapshotIds,
    snapshotDates: trends.snapshotDates,
    taxonomy,
    findings: squadFinding ? [...findings, squadFinding] : findings,
    warnings: trends.squad.warnings
  };
}

function generatePlayerFindings(
  trend: PlayerHistoricalTrend,
  series: PlayerSeriesPoint[],
  period: HistoricalFinding["period"]
): HistoricalFinding[] {
  const valuePercentage = trend.value.evidence.deltaPercentage;
  const wagePercentage = trend.wage.evidence.deltaPercentage;
  const skillDelta = totalSkillDelta(series);

  if (
    trend.value.evidence.dataPoints >= 3 &&
    trend.value.isComparable &&
    valuePercentage !== null &&
    valuePercentage >= 10 &&
    isStrictlyIncreasing(series.map((point) => point.value))
  ) {
    return [
      playerFinding(trend, "player_sustained_asset_appreciation", "info", confidence(trend), period, [
        evidence("derived", "value.deltaPercentage", "Estimated value grew across the analysed period.", valuePercentage),
        evidence("observed", "value.sequence", "Estimated value increased in every comparable snapshot.", series.length),
        evidence("derived", "skills.totalDelta", "Total observed skill level changed during the period.", skillDelta)
      ], "Monitor retention versus market timing; protect development unless liquidity needs justify selling.")
    ];
  }

  if (
    trend.value.isComparable &&
    ((valuePercentage !== null && valuePercentage <= -10) || skillDelta <= -2)
  ) {
    return [
      playerFinding(
        trend,
        "player_asset_or_sporting_deterioration",
        valuePercentage !== null && valuePercentage <= -20 ? "high" : "medium",
        confidence(trend),
        period,
        [
          evidence("derived", "value.deltaPercentage", "Estimated value deteriorated during the analysed period.", valuePercentage),
          evidence("derived", "skills.totalDelta", "Total observed skill level changed during the period.", skillDelta)
        ],
        "Review role, training fit and sale timing before further patrimonial loss accumulates."
      )
    ];
  }

  if (
    trend.value.evidence.dataPoints >= 3 &&
    trend.value.isComparable &&
    valuePercentage !== null &&
    Math.abs(valuePercentage) <= 5 &&
    skillDelta === 0
  ) {
    return [
      playerFinding(trend, "player_stagnation", "low", confidence(trend), period, [
        evidence("derived", "value.deltaPercentage", "Estimated value remained materially flat.", valuePercentage),
        evidence("derived", "skills.totalDelta", "No net observed skill growth was detected.", skillDelta)
      ], "Reassess training priority and squad role; keep only if tactical utility justifies the opportunity cost.")
    ];
  }

  if (
    trend.wage.isComparable &&
    wagePercentage !== null &&
    wagePercentage >= 15 &&
    (valuePercentage === null || valuePercentage < wagePercentage / 2)
  ) {
    return [
      playerFinding(
        trend,
        "risky_wage_against_historical_evolution",
        wagePercentage >= 30 && (valuePercentage === null || valuePercentage <= 0) ? "high" : "medium",
        confidence(trend),
        period,
        [
          evidence("derived", "wage.deltaPercentage", "Wage increased materially during the analysed period.", wagePercentage),
          evidence("derived", "value.deltaPercentage", "Asset evolution does not justify the wage growth.", valuePercentage)
        ],
        "Review contract burden against expected contribution; consider sale or role change if trend persists."
      )
    ];
  }

  return [];
}

function generateSquadFinding(
  trends: HistoricalTrends,
  period: HistoricalFinding["period"]
): HistoricalFinding | null {
  const valuePercentage = trends.squad.valueTotal.evidence.deltaPercentage;
  const wagePercentage = trends.squad.wageTotal.evidence.deltaPercentage;

  if (
    !trends.squad.valueTotal.isComparable ||
    !trends.squad.wageTotal.isComparable ||
    valuePercentage === null ||
    wagePercentage === null
  ) {
    return null;
  }

  if (valuePercentage <= -10 && wagePercentage >= 0) {
    return {
      type: "squad_asset_evolution",
      severity: valuePercentage <= -20 ? "high" : "medium",
      confidence: trends.squad.valueTotal.evidence.dataPoints >= 3 ? "high" : "medium",
      subject: { kind: "squad", clubId: trends.clubId },
      evidence: [
        evidence("derived", "squad.value.deltaPercentage", "Squad estimated value deteriorated.", valuePercentage),
        evidence("derived", "squad.wage.deltaPercentage", "Squad wage did not decrease alongside value.", wagePercentage)
      ],
      period,
      actionSuggested:
        "Audit wage allocation and player development priorities before committing new salary spend."
    };
  }

  return null;
}

function playerFinding(
  trend: PlayerHistoricalTrend,
  type: HistoricalFindingType,
  severity: Severity,
  confidenceValue: Confidence,
  period: HistoricalFinding["period"],
  findingEvidence: HistoricalFindingEvidence[],
  actionSuggested: string
): HistoricalFinding {
  return {
    type,
    severity,
    confidence: confidenceValue,
    subject: {
      kind: "player",
      playerId: trend.identity.playerId,
      playerName: trend.playerName
    },
    evidence: findingEvidence,
    period,
    actionSuggested
  };
}

function confidence(trend: PlayerHistoricalTrend): Confidence {
  if (trend.warnings.length > 0 || trend.value.evidence.warnings.length > 0) {
    return "low";
  }

  return trend.value.evidence.dataPoints >= 3 ? "high" : "medium";
}

function evidence(
  kind: EvidenceKind,
  metric: string,
  description: string,
  value?: HistoricalFindingEvidence["value"]
): HistoricalFindingEvidence {
  return { kind, metric, description, value };
}

function analysisPeriod(snapshots: SnapshotComparisonSnapshot[]): HistoricalFinding["period"] {
  const first = snapshots[0]!;
  const last = snapshots.at(-1)!;

  return {
    fromSnapshotId: first.id,
    toSnapshotId: last.id,
    fromDate: first.snapshotDate,
    toDate: last.snapshotDate,
    dataPoints: snapshots.length
  };
}

interface PlayerSeriesPoint {
  value: number;
  skills: Required<SkillSet>;
}

function buildPlayerSeries(snapshots: SnapshotComparisonSnapshot[]): Map<number, PlayerSeriesPoint[]> {
  const series = new Map<number, PlayerSeriesPoint[]>();

  for (const snapshot of snapshots) {
    const matchable = matchablePlayers(snapshot.players);

    for (const [playerId, player] of matchable) {
      series.set(playerId, [
        ...(series.get(playerId) ?? []),
        { value: player.value.amount, skills: player.skills }
      ]);
    }
  }

  return series;
}

function matchablePlayers(players: SnapshotComparisonPlayer[]): Map<number, SnapshotComparisonPlayer> {
  const byPlayerId = new Map<number, SnapshotComparisonPlayer[]>();

  for (const player of players) {
    if (player.playerId) {
      byPlayerId.set(player.playerId, [...(byPlayerId.get(player.playerId) ?? []), player]);
    }
  }

  return new Map(
    [...byPlayerId.entries()]
      .filter(([, playersWithIdentity]) => playersWithIdentity.length === 1)
      .map(([playerId, playersWithIdentity]) => [playerId, playersWithIdentity[0]!])
  );
}

function isStrictlyIncreasing(values: number[]): boolean {
  return values.length >= 3 && values.every((value, index) => index === 0 || value > values[index - 1]!);
}

function totalSkillDelta(series: PlayerSeriesPoint[]): number {
  const first = series[0];
  const last = series.at(-1);

  if (!first || !last) {
    return 0;
  }

  return SUPPORED_SKILLS.reduce((total, skill) => {
    const before = first.skills[skill];
    const after = last.skills[skill];

    if (before === null || after === null) {
      return total;
    }

    return total + (after - before);
  }, 0);
}

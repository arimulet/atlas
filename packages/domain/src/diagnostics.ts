import { SUPPORTED_SKILLS } from "./constants.js";
import type {
  AvailabilityStatus,
  DataTraceKind,
  Money,
  ObservedPosition,
  PlayerRole,
  Severity,
  SkillSet
} from "./types.js";

export type DiagnosticCategory =
  "squad-balance" | "economic-risk" | "asset-risk" | "training-potential" | "follow-up";

export type DiagnosticConfidence = "low" | "medium" | "high";

export type DiagnosticParameterValue = string | number | null;
export type DiagnosticParameters = Record<string, DiagnosticParameterValue>;

export interface DiagnosticTrace {
  kind: DataTraceKind;
  code: string;
  value: string | number | null;
  parameters?: DiagnosticParameters;
}

export interface DiagnosticAssumption {
  code: string;
  traceKind: "assumed";
  parameters?: DiagnosticParameters;
}

export interface DiagnosticRecommendation {
  code: string;
  traceKind: "recommended";
  parameters?: DiagnosticParameters;
}

export interface BasicDiagnosticFinding {
  code: string;
  category: DiagnosticCategory;
  severity: Severity;
  parameters?: DiagnosticParameters;
  evidence: DiagnosticTrace[];
  assumptions: DiagnosticAssumption[];
  confidence: DiagnosticConfidence;
  affectedPlayerIds: string[];
  recommendations: DiagnosticRecommendation[];
}

export interface BasicDiagnostic {
  snapshotId: string;
  generatedAt: string;
  findings: BasicDiagnosticFinding[];
}

export interface BasicDiagnosticSnapshot {
  id: string;
  players: BasicDiagnosticPlayerSnapshot[];
}

export interface BasicDiagnosticPlayerSnapshot {
  id: string;
  playerId: number | null;
  name: string;
  age: number;
  wage: Money;
  value: Money;
  form: number | null;
  availabilityStatus: AvailabilityStatus | null;
  observedPosition: ObservedPosition | null;
  position?: string | null;
  skills: Required<SkillSet>;
}

interface ClassifiedPlayer {
  player: BasicDiagnosticPlayerSnapshot;
  role: PlayerRole;
  roleScore: number;
  roleEvidence: DiagnosticTrace[];
  roleAssumptions: DiagnosticAssumption[];
}

const ORIGINAL_HIGH_WAGE_THRESHOLD = 80_000;
const ORIGINAL_ASSET_VALUE_THRESHOLD = 1_200_000;
const ORIGINAL_HIGH_ASSET_VALUE_THRESHOLD = 2_400_000;

const minimumPlayersByRole: Partial<Record<PlayerRole, number>> = {
  goalkeeper: 1,
  defender: 3,
  midfielder: 3,
  striker: 2
};

const roleAliases: Record<string, PlayerRole> = {
  gk: "goalkeeper",
  keeper: "goalkeeper",
  goalkeeper: "goalkeeper",
  portero: "goalkeeper",
  arquero: "goalkeeper",
  defender: "defender",
  defensa: "defender",
  df: "defender",
  def: "defender",
  midfielder: "midfielder",
  medio: "midfielder",
  volante: "midfielder",
  mid: "midfielder",
  winger: "winger",
  extremo: "winger",
  wing: "winger",
  striker: "striker",
  forward: "striker",
  delantero: "striker",
  att: "striker"
};

export function generateBasicDiagnostic(
  snapshot: BasicDiagnosticSnapshot,
  now: Date = new Date()
): BasicDiagnostic {
  const classifiedPlayers = snapshot.players.map(classifyPlayer);

  return {
    snapshotId: snapshot.id,
    generatedAt: now.toISOString(),
    findings: [
      ...createSquadBalanceFindings(classifiedPlayers),
      ...createEconomicRiskFindings(classifiedPlayers),
      ...createAssetRiskFindings(classifiedPlayers),
      ...createTrainingPotentialFindings(classifiedPlayers),
      ...createFollowUpFindings(classifiedPlayers)
    ]
  };
}

function classifyPlayer(player: BasicDiagnosticPlayerSnapshot): ClassifiedPlayer {
  const observedRole = roleFromObservedPosition(player.position ?? player.observedPosition);

  if (observedRole) {
    return {
      player,
      role: observedRole,
      roleScore: roleScore(observedRole, player.skills),
      roleEvidence: [
        trace("observed", "player.observed-position", player.position ?? player.observedPosition, {
          playerName: player.name
        }),
        trace("derived", "player.role-score", roleScore(observedRole, player.skills), {
          playerName: player.name,
          role: observedRole
        })
      ],
      roleAssumptions: []
    };
  }

  const { role, score } = inferPlayerRoleFromSkills(player.skills);

  if (score < 5) {
    return {
      player,
      role: "undefined",
      roleScore: score,
      roleEvidence: [
        trace("derived", "player.best-role-score", score, { playerName: player.name })
      ],
      roleAssumptions: [assumption("role-from-skills")]
    };
  }

  return {
    player,
    role,
    roleScore: score,
    roleEvidence: [trace("derived", "player.role-score", score, { playerName: player.name, role })],
    roleAssumptions: [assumption("role-from-skills")]
  };
}

export function inferPlayerRoleFromSkills(skills: Required<SkillSet>): {
  role: Exclude<PlayerRole, "trainee">;
  score: number;
} {
  const scores = roleScores(skills);
  const [role, score] = Object.entries(scores).sort((first, second) => second[1] - first[1])[0] as [
    Exclude<PlayerRole, "trainee" | "undefined">,
    number
  ];

  return { role, score };
}

function createSquadBalanceFindings(players: ClassifiedPlayer[]): BasicDiagnosticFinding[] {
  return Object.entries(minimumPlayersByRole).flatMap(([role, minimum]) => {
    const matchingPlayers = players.filter((classified) => classified.role === role);

    if (matchingPlayers.length >= minimum) {
      return [];
    }

    const missingCount = minimum - matchingPlayers.length;

    return [
      {
        code: `squad-balance.${role}.deficit`,
        category: "squad-balance",
        severity: missingCount >= 2 ? "high" : "medium",
        parameters: { role, currentCount: matchingPlayers.length, minimum, missingCount },
        evidence: [
          trace("derived", "squad.role.count", matchingPlayers.length, { role }),
          trace("assumed", "squad.role.baseline", minimum, { role })
        ],
        assumptions: [assumption("role-baseline", { role, minimum })],
        confidence: matchingPlayers.some((classified) => classified.roleAssumptions.length > 0)
          ? "medium"
          : "high",
        affectedPlayerIds: matchingPlayers.map(playerIdentifier),
        recommendations: [
          recommendation("review-role-depth", {
            role,
            currentCount: matchingPlayers.length,
            minimum,
            missingCount
          })
        ]
      }
    ];
  });
}

function createEconomicRiskFindings(players: ClassifiedPlayer[]): BasicDiagnosticFinding[] {
  const wages = players
    .map(({ player }) => player.wage.amount)
    .sort((first, second) => first - second);
  const medianWage = median(wages);
  const highWageThreshold = Math.max(ORIGINAL_HIGH_WAGE_THRESHOLD, medianWage * 1.5);

  return players.flatMap(({ player }) => {
    const valueToWageRatio =
      player.wage.amount === 0
        ? Number.POSITIVE_INFINITY
        : player.value.amount / player.wage.amount;
    const isRisk = player.wage.amount >= highWageThreshold && valueToWageRatio < 25;

    if (!isRisk) {
      return [];
    }

    return [
      {
        code: "economic-risk.high-wage-low-value-ratio",
        category: "economic-risk",
        severity: player.wage.amount >= highWageThreshold * 1.5 ? "high" : "medium",
        parameters: {
          playerName: player.name,
          wage: player.wage.amount,
          value: player.value.amount,
          ratio: round(valueToWageRatio)
        },
        evidence: [
          trace("observed", "player.wage", player.wage.amount, { playerName: player.name }),
          trace("observed", "player.estimated-value", player.value.amount, {
            playerName: player.name
          }),
          trace("derived", "squad.median-wage", medianWage),
          trace("derived", "player.value-to-wage-ratio", round(valueToWageRatio), {
            playerName: player.name
          })
        ],
        assumptions: [
          assumption("economic-threshold", {
            minimumWage: ORIGINAL_HIGH_WAGE_THRESHOLD,
            medianMultiplier: 1.5
          }),
          assumption("value-to-wage-threshold", { maximumRatio: 25 })
        ],
        confidence: "high",
        affectedPlayerIds: [playerIdentifier({ player })],
        recommendations: [
          recommendation("review-wage-burden", {
            playerName: player.name,
            wage: player.wage.amount,
            value: player.value.amount,
            ratio: round(valueToWageRatio)
          })
        ]
      }
    ];
  });
}

function createAssetRiskFindings(players: ClassifiedPlayer[]): BasicDiagnosticFinding[] {
  return players.flatMap(({ player }) => {
    const isRisk = player.age >= 30 && player.value.amount >= ORIGINAL_ASSET_VALUE_THRESHOLD;

    if (!isRisk) {
      return [];
    }

    return [
      {
        code: "asset-risk.senior-high-value",
        category: "asset-risk",
        severity:
          player.age >= 33 || player.value.amount >= ORIGINAL_HIGH_ASSET_VALUE_THRESHOLD
            ? "high"
            : "medium",
        parameters: { playerName: player.name, age: player.age, value: player.value.amount },
        evidence: [
          trace("observed", "player.age", player.age, { playerName: player.name }),
          trace("observed", "player.estimated-value", player.value.amount, {
            playerName: player.name
          })
        ],
        assumptions: [
          assumption("asset-age-threshold", { minimumAge: 30 }),
          assumption("asset-value-threshold", { minimumValue: ORIGINAL_ASSET_VALUE_THRESHOLD })
        ],
        confidence: "medium",
        affectedPlayerIds: [playerIdentifier({ player })],
        recommendations: [
          recommendation("track-player-value-evolution", {
            playerName: player.name,
            value: player.value.amount
          })
        ]
      }
    ];
  });
}

function createTrainingPotentialFindings(players: ClassifiedPlayer[]): BasicDiagnosticFinding[] {
  return players.flatMap((classified) => {
    const { player, roleScore } = classified;

    if (player.age > 23 || roleScore < 8) {
      return [];
    }

    return [
      {
        code: "training-potential.young-role-fit",
        category: "training-potential",
        severity: "low",
        parameters: { playerName: player.name, age: player.age, role: classified.role, roleScore },
        evidence: [
          trace("observed", "player.age", player.age, { playerName: player.name }),
          ...classified.roleEvidence,
          trace("derived", "player.role", classified.role, { playerName: player.name })
        ],
        assumptions: [
          ...classified.roleAssumptions,
          assumption("training-age-threshold", { maximumAge: 23 }),
          assumption("training-role-score-threshold", { minimumScore: 8 })
        ],
        confidence: classified.roleAssumptions.length > 0 ? "medium" : "high",
        affectedPlayerIds: [playerIdentifier(classified)],
        recommendations: [recommendation("review-player-training", { playerName: player.name })]
      }
    ];
  });
}

function createFollowUpFindings(players: ClassifiedPlayer[]): BasicDiagnosticFinding[] {
  return players.flatMap(({ player }) => {
    const missingFields = missingFollowUpFields(player);

    if (missingFields.length === 0) {
      return [];
    }

    return [
      {
        code: "follow-up.incomplete-player-data",
        category: "follow-up",
        severity: missingFields.includes("playerId") ? "medium" : "low",
        parameters: { playerName: player.name, missingFields: missingFields.join(", ") },
        evidence: missingFields.map((field) =>
          trace("observed", "player.missing-field", field, { playerName: player.name, field })
        ),

        assumptions: [
          assumption("incomplete-data-confidence"),
          ...(missingFields.includes("playerId") ? [assumption("missing-player-id")] : [])
        ],
        confidence: "low",
        affectedPlayerIds: [playerIdentifier({ player })],
        recommendations: [
          recommendation("review-player-source-data", {
            playerName: player.name,
            missingFields: missingFields.join(", ")
          })
        ]
      }
    ];
  });
}

function roleFromObservedPosition(position: string | null): ObservedPosition | null {
  if (!position) {
    return null;
  }

  const role = roleAliases[position.trim().toLowerCase()] ?? null;
  return role === "trainee" || role === "undefined" ? null : role;
}

function roleScores(
  skills: Required<SkillSet>
): Record<Exclude<PlayerRole, "trainee" | "undefined">, number> {
  return {
    goalkeeper: skill(skills.keeper),
    defender: average([skills.defender, skills.pace, skills.stamina]),
    midfielder: average([skills.playmaker, skills.passing, skills.technique, skills.stamina]),
    winger: average([skills.pace, skills.technique, skills.passing]),
    striker: average([skills.striker, skills.technique, skills.pace])
  };
}

function roleScore(role: PlayerRole, skills: Required<SkillSet>): number {
  if (role === "trainee" || role === "undefined") {
    return 0;
  }

  return roleScores(skills)[role];
}

function missingFollowUpFields(player: BasicDiagnosticPlayerSnapshot): string[] {
  return [
    player.playerId ? null : "playerId",
    player.form === null ? "form" : null,
    player.availabilityStatus === null ? "availabilityStatus" : null,
    player.position ? null : "position",
    ...SUPPORTED_SKILLS.map((skillKey) =>
      player.skills[skillKey] === null ? `skills.${skillKey}` : null
    )
  ].filter((field): field is string => field !== null);
}

function playerIdentifier(classified: Pick<ClassifiedPlayer, "player">): string {
  return classified.player.playerId?.toString() ?? classified.player.id;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const midpoint = Math.floor(values.length / 2);

  if (values.length % 2 === 1) {
    return values[midpoint] ?? 0;
  }

  return ((values[midpoint - 1] ?? 0) + (values[midpoint] ?? 0)) / 2;
}

function average(values: Array<number | null | undefined>): number {
  const knownValues = values.filter((value): value is number => typeof value === "number");

  if (knownValues.length === 0) {
    return 0;
  }

  return round(knownValues.reduce((total, value) => total + value, 0) / knownValues.length);
}

function skill(value: number | null | undefined): number {
  return value ?? 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function trace(
  kind: DataTraceKind,
  code: string,
  value: string | number | null,
  parameters?: DiagnosticParameters
): DiagnosticTrace {
  return { kind, code, value, ...(parameters ? { parameters } : {}) };
}

function assumption(code: string, parameters?: DiagnosticParameters): DiagnosticAssumption {
  return { code, traceKind: "assumed", ...(parameters ? { parameters } : {}) };
}

function recommendation(code: string, parameters?: DiagnosticParameters): DiagnosticRecommendation {
  return { code, traceKind: "recommended", ...(parameters ? { parameters } : {}) };
}

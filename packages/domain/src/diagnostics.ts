import type { AvailabilityStatus, DataTraceKind, Money, ObservedPosition, PlayerRole, Severity, SkillSet } from "./index.js";

export type DiagnosticCategory =
  "squad-balance" | "economic-risk" | "asset-risk" | "training-potential" | "follow-up";

export type DiagnosticConfidence = "low" | "medium" | "high";

export interface DiagnosticTrace {
  kind: DataTraceKind;
  label: string;
  value: string | number | null;
}

export interface DiagnosticAssumption {
  code: string;
  description: string;
  traceKind: "assumed";
}

export interface DiagnosticRecommendation {
  traceKind: "recommended";
  description: string;
  rationale: string;
}

export interface BasicDiagnosticFinding {
  code: string;
  category: DiagnosticCategory;
  severity: Severity;
  description: string;
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
  skills: Required<SkillSet>;
}

interface ClassifiedPlayer {
  player: BasicDiagnosticPlayerSnapshot;
  role: PlayerRole;
  roleScore: number;
  roleEvidence: DiagnosticTrace[];
  roleAssumptions: DiagnosticAssumption[];
}

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
  midfielder: "midfielder",
  medio: "midfielder",
  volante: "midfielder",
  winger: "winger",
  extremo: "winger",
  wing: "winger",
  striker: "striker",
  forward: "striker",
  delantero: "striker"
};

const trackedSkillKeys = [
  "stamina",
  "pace",
  "technique",
  "passing",
  "keeper",
  "defender",
  "playmaker",
  "striker"
] as const;

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
  const observedRole = roleFromObservedPosition(player.observedPosition);

  if (observedRole) {
    return {
      player,
      role: observedRole,
      roleScore: roleScore(observedRole, player.skills),
      roleEvidence: [
        trace("observed", `${player.name} observed position`, player.observedPosition),
        trace("derived", `${player.name} role score`, roleScore(observedRole, player.skills))
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
      roleEvidence: [trace("derived", `${player.name} best role score`, score)],
      roleAssumptions: [
        assumption(
          "role-from-skills",
          "Observed position is missing; role is inferred from visible skills."
        )
      ]
    };
  }

  return {
    player,
    role,
    roleScore: score,
    roleEvidence: [trace("derived", `${player.name} inferred ${role} score`, score)],
    roleAssumptions: [
      assumption(
        "role-from-skills",
        "Observed position is missing; role is inferred from visible skills."
      )
    ]
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
        description: `Squad has ${matchingPlayers.length} ${role} player(s), below the baseline of ${minimum}.`,
        evidence: [
          trace("derived", `${role} players`, matchingPlayers.length),
          trace("assumed", `${role} baseline`, minimum)
        ],
        assumptions: [
          assumption(
            "role-baseline",
            "Baseline role counts are initial MVP thresholds, not tactical advice."
          )
        ],
        confidence: matchingPlayers.some((classified) => classified.roleAssumptions.length > 0)
          ? "medium"
          : "high",
        affectedPlayerIds: matchingPlayers.map(playerIdentifier),
        recommendations: [
          recommendation(
            `Review ${role} depth before making squad decisions.`,
            `The current count is ${missingCount} below the explicit baseline.`
          )
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
  const highWageThreshold = Math.max(20000, medianWage * 1.5);

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
        description: `${player.name} has a high wage relative to the squad and estimated value.`,
        evidence: [
          trace("observed", `${player.name} wage`, player.wage.amount),
          trace("observed", `${player.name} estimated value`, player.value.amount),
          trace("derived", "squad median wage", medianWage),
          trace("derived", `${player.name} value-to-wage ratio`, round(valueToWageRatio))
        ],
        assumptions: [
          assumption(
            "economic-threshold",
            "High wage risk starts at max(20000, 1.5x squad median wage)."
          ),
          assumption(
            "value-to-wage-threshold",
            "A value-to-wage ratio below 25 is treated as inefficient for MVP diagnostics."
          )
        ],
        confidence: "high",
        affectedPlayerIds: [playerIdentifier({ player })],
        recommendations: [
          recommendation(
            `Review ${player.name}'s wage burden before renewal or squad planning.`,
            "The recommendation is based on observed wage, observed estimated value and the explicit MVP ratio threshold."
          )
        ]
      }
    ];
  });
}

function createAssetRiskFindings(players: ClassifiedPlayer[]): BasicDiagnosticFinding[] {
  return players.flatMap(({ player }) => {
    const isRisk = player.age >= 30 && player.value.amount >= 300000;

    if (!isRisk) {
      return [];
    }

    return [
      {
        code: "asset-risk.senior-high-value",
        category: "asset-risk",
        severity: player.age >= 33 || player.value.amount >= 600000 ? "high" : "medium",
        description: `${player.name} combines senior age with meaningful estimated value.`,
        evidence: [
          trace("observed", `${player.name} age`, player.age),
          trace("observed", `${player.name} estimated value`, player.value.amount)
        ],
        assumptions: [
          assumption(
            "asset-age-threshold",
            "Players aged 30 or more are flagged for MVP asset risk review."
          ),
          assumption(
            "asset-value-threshold",
            "Estimated value of 300000 or more is treated as material for MVP diagnostics."
          )
        ],
        confidence: "medium",
        affectedPlayerIds: [playerIdentifier({ player })],
        recommendations: [
          recommendation(
            `Track ${player.name}'s value evolution before delaying a market decision.`,
            "The recommendation is explained by the combination of observed age and observed estimated value."
          )
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
        description: `${player.name} is young and already shows a strong role fit.`,
        evidence: [
          trace("observed", `${player.name} age`, player.age),
          ...classified.roleEvidence,
          trace("derived", `${player.name} role`, classified.role)
        ],
        assumptions: [
          ...classified.roleAssumptions,
          assumption(
            "training-age-threshold",
            "Players aged 23 or less are considered trainable in the MVP."
          ),
          assumption(
            "training-role-score-threshold",
            "A role score of 8 or more indicates initial training potential."
          )
        ],
        confidence: classified.roleAssumptions.length > 0 ? "medium" : "high",
        affectedPlayerIds: [playerIdentifier(classified)],
        recommendations: [
          recommendation(
            `Consider ${player.name} for focused training review.`,
            "The recommendation is based on observed age and the explicit derived role-fit score."
          )
        ]
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
        description: `${player.name} requires follow-up because imported data is incomplete.`,
        evidence: missingFields.map((field) =>
          trace("observed", `${player.name} missing ${field}`, null)
        ),
        assumptions: [
          assumption(
            "incomplete-data-confidence",
            "Missing observed fields lower diagnostic confidence."
          ),
          ...(missingFields.includes("playerId")
            ? [
                assumption(
                  "missing-player-id",
                  "Player identity must not be merged automatically without playerId or manual review."
                )
              ]
            : [])
        ],
        confidence: "low",
        affectedPlayerIds: [playerIdentifier({ player })],
        recommendations: [
          recommendation(
            `Review source data for ${player.name} before relying on historical comparisons.`,
            "The recommendation is explained by the listed missing observed fields."
          )
        ]
      }
    ];
  });
}

function roleFromObservedPosition(position: ObservedPosition | null): ObservedPosition | null {
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
    player.observedPosition ? null : "observedPosition",
    ...trackedSkillKeys.map((skillKey) =>
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

function trace(kind: DataTraceKind, label: string, value: string | number | null): DiagnosticTrace {
  return { kind, label, value };
}

function assumption(code: string, description: string): DiagnosticAssumption {
  return { code, description, traceKind: "assumed" };
}

function recommendation(description: string, rationale: string): DiagnosticRecommendation {
  return { traceKind: "recommended", description, rationale };
}

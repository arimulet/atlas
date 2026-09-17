import type {
  DiagnosticFinding,
  DiagnosticParameterValue,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  Severity,
  TrainingPageData,
  YouthPipelinePlanning
} from "@atlas/web/app/types";
import type { TrainingDiagnostic } from "./training-view-model";
import { formatDiagnosticNumber } from "../formatters";

export type DiagnosticArea = "Training" | "Squad" | "Youth" | "Player";
export type DiagnosticSubjectType = "player" | "youth";

export interface DiagnosticSubject {
  id?: string;
  type: DiagnosticSubjectType;
  label: string;
  countryName?: string | null;
}

export interface DiagnosticContextItem {
  label: string;
  value: string;
}

export interface DiagnosticViewModel {
  id: string;
  severity: Severity;
  area: DiagnosticArea;
  subject?: DiagnosticSubject;
  message: string;
  context?: string;
  contextItems?: DiagnosticContextItem[];
}

export interface DiagnosticsPageViewModel {
  summary: {
    total: number;
    bySeverity: Partial<Record<Severity, number>>;
  };
  diagnostics: DiagnosticViewModel[];
}

export interface CreateDiagnosticsPageViewModelInput {
  development: PlayerDevelopment | null;
  training: TrainingPageData | null;
  trainingDiagnostic: TrainingDiagnostic | null;
  youthAcademy: RealYouthAcademyPlanning | null;
  youthPipeline: YouthPipelinePlanning | null;
}

const severityOrder: Record<Severity, number> = {
  high: 4,
  medium: 3,
  low: 2,
  info: 1
};

export function createDiagnosticsPageViewModel(
  input: CreateDiagnosticsPageViewModelInput
): DiagnosticsPageViewModel {
  const playerIndex = createPlayerIndex(input);
  const diagnostics: DiagnosticViewModel[] = [];
  const identities = new Set<string>();

  for (const finding of input.trainingDiagnostic?.findings ?? []) {
    const subject = subjectForTrainingFinding(finding, playerIndex);
    const { context, contextItems } = processEvidence(finding.evidence);

    appendDiagnostic(diagnostics, identities, {
      id: `training-diagnostic:${finding.code}:${subjectIdentity(subject, finding.code)}`,
      severity: finding.severity,
      area: trainingAreaForFinding(finding, subject),
      subject,
      message: describeDiagnosticsFinding(finding),
      context,
      contextItems
    });
  }

  for (const player of input.development?.derived.players ?? []) {
    const subject = playerSubject(player.name, player.playerId);

    for (const finding of player.findings) {
      // The current Dashboard Attention intentionally leaves positive development findings out.
      if (finding.type === "improvement") {
        continue;
      }
      const { context, contextItems } = processEvidence(finding.evidence);

      appendDiagnostic(diagnostics, identities, {
        id: `player-development:${finding.type}:${subjectIdentity(subject, finding.type)}`,
        severity: finding.severity,
        area: "Player",
        subject,
        message: finding.description,
        context,
        contextItems
      });
    }
  }

  for (const player of input.youthPipeline?.derived.players ?? []) {
    // Standout prospects are opportunities, not issues requiring attention in the existing Dashboard.
    if (player.category === "standout_prospect") {
      continue;
    }

    const subject = playerSubject(player.name, player.playerId);

    for (const signal of player.signals) {
      const { context, contextItems } = processEvidence(signal.evidence);

      appendDiagnostic(diagnostics, identities, {
        id: `youth-pipeline:${signal.code}:${subjectIdentity(subject, signal.code)}`,
        severity: signal.severity,
        area: "Youth",
        subject,
        message: signal.message,
        context,
        contextItems
      });
    }
  }

  for (const player of input.youthAcademy?.derived.players ?? []) {
    const subject: DiagnosticSubject = {
      id: player.id,
      type: "youth",
      label: player.name,
      ...(player.countryName ? { countryName: player.countryName } : {})
    };

    for (const signal of player.signals) {
      // This is the same positive-signal exclusion used by Youth Attention.
      if (signal.code === "standout_youth_prospect") {
        continue;
      }
      const { context, contextItems } = processEvidence(signal.evidence);

      appendDiagnostic(diagnostics, identities, {
        id: `youth-academy:${signal.code}:${player.id}`,
        severity: signal.severity,
        area: "Youth",
        subject,
        message: signal.message,
        context,
        contextItems
      });
    }
  }

  const orderedDiagnostics = diagnostics
    .map((diagnostic, index) => ({ diagnostic, index }))
    .sort(
      (left, right) =>
        severityOrder[right.diagnostic.severity] - severityOrder[left.diagnostic.severity] ||
        left.index - right.index
    )
    .map(({ diagnostic }) => diagnostic);

  return {
    summary: {
      total: orderedDiagnostics.length,
      bySeverity: orderedDiagnostics.reduce<Partial<Record<Severity, number>>>(
        (summary, diagnostic) => {
          summary[diagnostic.severity] = (summary[diagnostic.severity] ?? 0) + 1;
          return summary;
        },
        {}
      )
    },
    diagnostics: orderedDiagnostics
  };
}

interface PlayerIndex {
  byId: Map<string, DiagnosticSubject>;
  byName: Map<string, DiagnosticSubject>;
}

function createPlayerIndex(input: CreateDiagnosticsPageViewModelInput): PlayerIndex {
  const byId = new Map<string, DiagnosticSubject>();
  const byName = new Map<string, DiagnosticSubject>();

  for (const player of input.development?.observed.players ?? []) {
    const subject = playerSubject(player.name, player.playerId);
    byName.set(player.name, subject);
    byId.set(player.snapshotPlayerId, subject);

    if (player.playerId !== null) {
      byId.set(String(player.playerId), subject);
    }
  }

  for (const player of input.training?.players ?? []) {
    const existingSubject = byName.get(player.name);
    const subject =
      existingSubject?.id !== undefined
        ? existingSubject
        : playerSubject(player.name, player.playerId, player.countryName);
    if (!subject.countryName && player.countryName) {
      subject.countryName = player.countryName;
    }
    byName.set(player.name, subject);
    byId.set(player.id, subject);
    byId.set(String(player.playerId), subject);
  }

  return { byId, byName };
}

function subjectForTrainingFinding(
  finding: DiagnosticFinding,
  playerIndex: PlayerIndex
): DiagnosticSubject | undefined {
  const playerName = finding.parameters?.playerName;

  if (typeof playerName === "string") {
    return playerIndex.byName.get(playerName) ?? playerSubject(playerName);
  }

  if (finding.category === "squad-balance") {
    return undefined;
  }

  for (const playerId of finding.affectedPlayerIds) {
    const subject = playerIndex.byId.get(playerId);

    if (subject) {
      return subject;
    }
  }

  return undefined;
}

function trainingAreaForFinding(
  finding: DiagnosticFinding,
  subject: DiagnosticSubject | undefined
): DiagnosticArea {
  if (finding.category === "training-potential") {
    return "Training";
  }

  if (finding.category === "squad-balance" || !subject) {
    return "Squad";
  }

  return "Player";
}

function playerSubject(
  name: string,
  id?: string | number | null,
  countryName?: string | null
): DiagnosticSubject {
  return {
    id: id === null || id === undefined ? undefined : String(id),
    type: "player",
    label: name,
    ...(countryName ? { countryName } : {})
  };
}

function subjectIdentity(subject: DiagnosticSubject | undefined, source: string): string {
  return subject?.id ?? subject?.label ?? source;
}

const evidenceLabelMap: Record<string, string> = {
  "player.wage": "Wage",
  "player.estimated-value": "Estimated Value",
  "squad.median-wage": "Median Wage",
  "player.value-to-wage-ratio": "Value/Wage Ratio",
  "squad.role.count": "Current Count",
  "squad.role.baseline": "Minimum Baseline",
  "player.age": "Age",
  "player.observed-position": "Position",
  "player.role": "Position",
  "player.role-score": "Role Score",
  "player.best-role-score": "Best Role Score",
  "player.missing-field": "Missing Field",
  "Snapshots disponibles": "Available Snapshots",
  "Snapshots del club": "Club Snapshots",
  "Snapshots comparables": "Comparable Snapshots",
  "Con salario": "With Wage",
  "Con valor estimado": "With Estimated Value",
  "Participacion salarial": "Wage Share",
  "Participacion de valor": "Value Share",
  "Ratio salario/valor": "Wage/Value Ratio",
  "Ratio salario/valor jugador": "Wage/Value Ratio",
  "Tolerancia de riesgo": "Risk Tolerance",
  "Masa salarial": "Total Payroll",
  "Valor estimado": "Estimated Value",
  "Salario": "Wage",
  "Jugador": "Player",
  "Jugadores": "Players",
  "Edad": "Age",
  "Posición": "Position",
  "Posicion": "Position",
  "Rol": "Position"
};

function formatEvidenceLabel(keyOrCode: string): string {
  if (evidenceLabelMap[keyOrCode]) {
    return evidenceLabelMap[keyOrCode];
  }
  const cleaned = keyOrCode
    .replace(/^(player|squad)\./, "")
    .replace(/[-_.]/g, " ")
    .trim();
  const lower = cleaned.toLowerCase();
  if (lower === "observed position" || lower === "role") {
    return "Position";
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function formatEvidenceValue(
  label: string,
  rawKey: string,
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    const keyLower = (rawKey + " " + label).toLowerCase();

    // Money fields
    if (
      keyLower.includes("wage") ||
      keyLower.includes("salario") ||
      keyLower.includes("value") ||
      keyLower.includes("valor") ||
      keyLower.includes("payroll") ||
      keyLower.includes("cost")
    ) {
      if (!keyLower.includes("ratio") && !keyLower.includes("share") && !keyLower.includes("score")) {
        return `$${value.toLocaleString("en-US")}`;
      }
    }

    // Ratio fields
    if (keyLower.includes("ratio")) {
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}x`;
    }

    // Percentage fields
    if (
      keyLower.includes("share") ||
      keyLower.includes("percent") ||
      keyLower.includes("participacion") ||
      keyLower.includes("participación") ||
      keyLower.includes("variacion") ||
      keyLower.includes("variación")
    ) {
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
    }

    // Age fields
    if (keyLower.includes("age") || keyLower.includes("edad")) {
      return `${value} yrs`;
    }

    return value.toLocaleString("en-US");
  }

  const strVal = String(value);
  const lowerStr = strVal.toLowerCase();
  if (lowerStr === "goalkeeper") return "Goalkeeper";
  if (lowerStr === "defender") return "Defender";
  if (lowerStr === "midfielder") return "Midfielder";
  if (lowerStr === "winger") return "Winger";
  if (lowerStr === "striker") return "Striker";

  return strVal;
}

export function processEvidence(
  evidence: Array<{
    code?: string;
    label?: string;
    value: string | number | null | undefined;
  }> | undefined
): { context?: string; contextItems?: DiagnosticContextItem[] } {
  if (!evidence || evidence.length === 0) {
    return {};
  }

  const items: DiagnosticContextItem[] = [];
  const seenLabels = new Set<string>();

  for (const item of evidence) {
    if (item.value === null || item.value === undefined || item.value === "") {
      continue;
    }
    const rawKey = item.label ?? item.code ?? "Evidence";
    if (
      rawKey === "Player" ||
      rawKey === "Jugador" ||
      rawKey === "Nombre" ||
      rawKey === "Name" ||
      rawKey === "player.name" ||
      rawKey === "playerName" ||
      rawKey === "Snapshot anterior" ||
      rawKey === "Snapshot actual" ||
      rawKey === "Fecha anterior" ||
      rawKey === "Fecha actual" ||
      rawKey === "Previous date" ||
      rawKey === "Current date" ||
      rawKey === "snapshot.id" ||
      rawKey === "snapshotId" ||
      rawKey === "previousSnapshotId" ||
      rawKey === "Available snapshots" ||
      rawKey === "Available Snapshots" ||
      rawKey === "Snapshots disponibles" ||
      rawKey === "Snapshots del club" ||
      rawKey === "Snapshots comparables" ||
      rawKey === "Net skill delta"
    ) {
      continue;
    }

    const label = formatEvidenceLabel(rawKey);
    if (seenLabels.has(label)) {
      continue;
    }
    seenLabels.add(label);

    const formattedVal = formatEvidenceValue(label, rawKey, item.value);

    items.push({
      label,
      value: formattedVal
    });
  }

  if (items.length === 0) {
    return {};
  }

  const contextStr = items.map((it) => `${it.label}: ${it.value}`).join(" · ");

  return {
    context: contextStr,
    contextItems: items
  };
}

function appendDiagnostic(
  diagnostics: DiagnosticViewModel[],
  identities: Set<string>,
  diagnostic: DiagnosticViewModel
): void {
  if (identities.has(diagnostic.id)) {
    return;
  }

  identities.add(diagnostic.id);
  diagnostics.push(diagnostic);
}

const roleLabels: Record<string, string> = {
  goalkeeper: "goalkeeper",
  defender: "defender",
  midfielder: "midfielder",
  winger: "winger",
  striker: "striker"
};

export function describeDiagnosticsFinding(finding: DiagnosticFinding): string {
  const parameters = finding.parameters ?? {};

  if (finding.code.startsWith("squad-balance.") && finding.code.endsWith(".deficit")) {
    return (
      "Squad has " +
      formatDiagnosticNumber(parameters.currentCount) +
      " player(s) in " +
      diagnosticRoleLabel(parameters.role) +
      "; benchmark minimum is " +
      formatDiagnosticNumber(parameters.minimum) +
      "."
    );
  }

  switch (finding.code) {
    case "economic-risk.high-wage-low-value-ratio":
      return (
        diagnosticStringValue(parameters.playerName) +
        " has a high wage (" +
        formatDiagnosticNumber(parameters.wage) +
        ") relative to estimated value (" +
        formatDiagnosticNumber(parameters.value) +
        ")."
      );
    case "asset-risk.senior-high-value":
      return (
        diagnosticStringValue(parameters.playerName) +
        " combines senior age with significant estimated value (" +
        formatDiagnosticNumber(parameters.value) +
        ")."
      );
    case "training-potential.young-role-fit":
      return diagnosticStringValue(parameters.playerName) + " is young and shows a good fit for their role.";
    case "follow-up.incomplete-player-data":
      return (
        diagnosticStringValue(parameters.playerName) +
        " requires follow-up due to incomplete imported data."
      );
    default:
      return finding.code;
  }
}

function diagnosticRoleLabel(value: DiagnosticParameterValue | undefined): string {
  return roleLabels[diagnosticStringValue(value)] ?? diagnosticStringValue(value);
}

function diagnosticStringValue(value: DiagnosticParameterValue | undefined): string {
  return value === null || value === undefined ? "n/a" : String(value);
}

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

export type DiagnosticArea = "Training" | "Squad" | "Youth" | "Player";
export type DiagnosticSubjectType = "player" | "youth";

export interface DiagnosticSubject {
  id?: string;
  type: DiagnosticSubjectType;
  label: string;
}

export interface DiagnosticViewModel {
  id: string;
  severity: Severity;
  area: DiagnosticArea;
  subject?: DiagnosticSubject;
  message: string;
  context?: string;
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

    appendDiagnostic(diagnostics, identities, {
      id: `training-diagnostic:${finding.code}:${subjectIdentity(subject, finding.code)}`,
      severity: finding.severity,
      area: trainingAreaForFinding(finding, subject),
      subject,
      message: describeDiagnosticsFinding(finding),
      context: contextFromEvidence(finding.evidence)
    });
  }

  for (const player of input.development?.derived.players ?? []) {
    const subject = playerSubject(player.name, player.playerId);

    for (const finding of player.findings) {
      // The current Dashboard Attention intentionally leaves positive development findings out.
      if (finding.type === "improvement") {
        continue;
      }

      appendDiagnostic(diagnostics, identities, {
        id: `player-development:${finding.type}:${subjectIdentity(subject, finding.type)}`,
        severity: finding.severity,
        area: "Player",
        subject,
        message: finding.description,
        context: contextFromEvidence(finding.evidence)
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
      appendDiagnostic(diagnostics, identities, {
        id: `youth-pipeline:${signal.code}:${subjectIdentity(subject, signal.code)}`,
        severity: signal.severity,
        area: "Youth",
        subject,
        message: signal.message,
        context: contextFromEvidence(signal.evidence)
      });
    }
  }

  for (const player of input.youthAcademy?.derived.players ?? []) {
    const subject: DiagnosticSubject = {
      id: player.id,
      type: "youth",
      label: player.name
    };

    for (const signal of player.signals) {
      // This is the same positive-signal exclusion used by Youth Attention.
      if (signal.code === "standout_youth_prospect") {
        continue;
      }

      appendDiagnostic(diagnostics, identities, {
        id: `youth-academy:${signal.code}:${player.id}`,
        severity: signal.severity,
        area: "Youth",
        subject,
        message: signal.message,
        context: contextFromEvidence(signal.evidence)
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
        : playerSubject(player.name, player.playerId);
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

function playerSubject(name: string, id?: string | number | null): DiagnosticSubject {
  return {
    id: id === null || id === undefined ? undefined : String(id),
    type: "player",
    label: name
  };
}

function subjectIdentity(subject: DiagnosticSubject | undefined, source: string): string {
  return subject?.id ?? subject?.label ?? source;
}

function contextFromEvidence(
  evidence: Array<{
    code?: string;
    label?: string;
    value: string | number | null | undefined;
  }>
): string | undefined {
  const context = evidence
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
    .map((item) => `${item.label ?? item.code ?? "Evidence"}: ${String(item.value)}`)
    .join(" · ");

  return context || undefined;
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
  goalkeeper: "arquero",
  defender: "defensor",
  midfielder: "mediocampista",
  winger: "extremo",
  striker: "delantero"
};

export function describeDiagnosticsFinding(finding: DiagnosticFinding): string {
  const parameters = finding.parameters ?? {};

  if (finding.code.startsWith("squad-balance.") && finding.code.endsWith(".deficit")) {
    return (
      "La plantilla tiene " +
      formatDiagnosticNumber(parameters.currentCount) +
      " jugador(es) en " +
      diagnosticRoleLabel(parameters.role) +
      "; el mínimo de referencia es " +
      formatDiagnosticNumber(parameters.minimum) +
      "."
    );
  }

  switch (finding.code) {
    case "economic-risk.high-wage-low-value-ratio":
      return (
        diagnosticStringValue(parameters.playerName) +
        " tiene un salario alto (" +
        formatDiagnosticNumber(parameters.wage) +
        ") en relación con su valor estimado (" +
        formatDiagnosticNumber(parameters.value) +
        ")."
      );
    case "asset-risk.senior-high-value":
      return (
        diagnosticStringValue(parameters.playerName) +
        " combina una edad senior con un valor estimado relevante (" +
        formatDiagnosticNumber(parameters.value) +
        ")."
      );
    case "training-potential.young-role-fit":
      return diagnosticStringValue(parameters.playerName) + " es joven y muestra un buen ajuste para su rol.";
    case "follow-up.incomplete-player-data":
      return (
        diagnosticStringValue(parameters.playerName) +
        " requiere seguimiento porque sus datos importados están incompletos."
      );
    default:
      return finding.code;
  }
}

function diagnosticRoleLabel(value: DiagnosticParameterValue | undefined): string {
  return roleLabels[diagnosticStringValue(value)] ?? diagnosticStringValue(value);
}

function diagnosticStringValue(value: DiagnosticParameterValue | undefined): string {
  return value === null || value === undefined ? "dato no disponible" : String(value);
}

function formatDiagnosticNumber(value: DiagnosticParameterValue | undefined): string {
  return typeof value === "number"
    ? value.toLocaleString("es-AR")
    : diagnosticStringValue(value);
}

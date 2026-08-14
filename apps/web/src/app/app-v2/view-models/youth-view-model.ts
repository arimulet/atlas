import type {
  RealYouthAcademyPlayerPlan,
  RealYouthAcademyPlanning,
  Severity
} from "@atlas/web/app/types";

export type YouthStatusLabel = "In academy" | "Promotion" | "Promoted" | "Attention" | "Review";

export interface YouthLevelValue {
  value: number;
  label: string | null;
}

export interface YouthPlayerRow {
  id: string;
  name: string;
  age: number;
  position: string | null;
  level: YouthLevelValue | null;
  weeksLeft: number | null;
  progress: number | null;
  status: YouthStatusLabel | null;
}

export interface YouthAttentionItem {
  id: string;
  playerName: string | null;
  message: string;
  severity: Severity;
}

const severityOrder: Record<Severity, number> = {
  high: 4,
  medium: 3,
  low: 2,
  info: 1
};

export function createYouthPlayerRows(planning: RealYouthAcademyPlanning | null): YouthPlayerRow[] {
  return (planning?.derived.players ?? []).map((player) => ({
    id: player.id,
    name: player.name,
    age: player.age,
    position: null,
    level: player.skill === null ? null : { value: player.skill, label: null },
    weeksLeft: player.weeksRemaining,
    progress: null,
    status: youthStatusForPlayer(player)
  }));
}

export function createYouthAttentionItems(
  planning: RealYouthAcademyPlanning | null
): YouthAttentionItem[] {
  if (!planning) {
    return [];
  }

  const items: Array<YouthAttentionItem & { order: number }> = [];
  let order = 0;

  for (const player of planning.derived.players) {
    for (const signal of player.signals) {
      if (signal.code === "standout_youth_prospect") {
        continue;
      }

      items.push({
        id: `${player.id}-${signal.code}`,
        playerName: player.name,
        message: signal.message,
        severity: signal.severity,
        order: order++
      });
    }

    for (const warning of player.warnings) {
      items.push({
        id: `${player.id}-${warning.code}`,
        playerName: player.name,
        message: youthWarningMessage(warning.code),
        severity: "info",
        order: order++
      });
    }
  }

  for (const warning of planning.warnings) {
    items.push({
      id: `planning-${warning.code}`,
      playerName: null,
      message: youthWarningMessage(warning.code),
      severity: "info",
      order: order++
    });
  }

  return items
    .sort(
      (first, second) =>
        severityOrder[second.severity] - severityOrder[first.severity] || first.order - second.order
    )
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      playerName: item.playerName,
      message: item.message,
      severity: item.severity
    }));
}

function youthStatusForPlayer(player: RealYouthAcademyPlayerPlan): YouthStatusLabel {
  if (player.category === "stagnation_risk") {
    return "Attention";
  }

  if (player.status === "ready_for_promotion") {
    return "Promotion";
  }

  if (player.status === "promoted") {
    return "Promoted";
  }

  if (player.warnings.length > 0) {
    return "Review";
  }

  return "In academy";
}

function youthWarningMessage(code: string): string {
  const messages: Record<string, string> = {
    missing_weeks_remaining: "Missing weeks-left data",
    missing_skill: "Missing current-level data",
    no_youth_snapshots: "No youth snapshots available",
    insufficient_youth_snapshots: "Youth history is limited"
  };

  return messages[code] ?? "Youth data requires review";
}

import type { RealYouthAcademyPlayerPlan, RealYouthAcademyPlanning } from "@atlas/web/app/types";
import { skillLevelLabel } from "./skill-level-label";

export type YouthStatusLabel = "In academy" | "Promotion" | "Promoted" | "Attention" | "Review";
export type YouthPromotionLabel = "Ready" | "Promoted";

export interface YouthLevelValue {
  value: number;
  label: string | null;
  change: number | null;
}

export interface YouthPlayerRow {
  id: string;
  name: string;
  age: number;
  position: string | null;
  level: YouthLevelValue | null;
  expectedLevel: number | null;
  initialWeeks: number | null;
  levelPops: number | null;
  talent: number | null;
  weeksLeft: number | null;
  progress: number | null;
  attentions: YouthPlayerAttention[];
  promotion: YouthPromotionLabel | null;
  status: YouthStatusLabel | null;
}

export interface YouthPlayerAttention {
  id: string;
  message: string;
  severity: RealYouthAcademyPlayerPlan["severity"];
}
export function createYouthPlayerRows(planning: RealYouthAcademyPlanning | null): YouthPlayerRow[] {
  return (planning?.derived.players ?? []).map((player) => ({
    id: player.id,
    name: player.name,
    age: player.age,
    position: null,
    level:
      player.skill === null
        ? null
        : {
            value: player.skill,
            label: skillLevelLabel(player.skill),
            change: player.skillChange
          },
    expectedLevel: player.expectedLevel,
    initialWeeks: player.initialWeeks,
    levelPops: player.levelPops,
    talent: player.talent,
    weeksLeft: player.weeksRemaining,
    progress: null,
    attentions: youthAttentionForPlayer(player),
    promotion: youthPromotionForPlayer(player),
    status: youthStatusForPlayer(player)
  }));
}

function youthAttentionForPlayer(player: RealYouthAcademyPlayerPlan): YouthPlayerAttention[] {
  return [
    ...player.signals
      .filter((signal) => signal.code !== "standout_youth_prospect")
      .map((signal) => ({
        id: signal.code,
        message: signal.message,
        severity: signal.severity
      })),
    ...player.warnings.map((warning) => ({
      id: warning.code,
      message: youthWarningMessage(warning.code),
      severity: "info" as const
    }))
  ];
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

function youthPromotionForPlayer(player: RealYouthAcademyPlayerPlan): YouthPromotionLabel | null {
  if (player.status === "ready_for_promotion") {
    return "Ready";
  }

  if (player.status === "promoted") {
    return "Promoted";
  }

  return null;
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

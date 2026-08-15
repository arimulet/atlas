import type {
  MatchFormation,
  MatchPlayerParticipationInput,
  MatchPlayerRole
} from "./types.js";

export * from "./types.js";

export function normalizeMatchFormation(value: number): MatchFormation {
  const formationByValue: Record<number, MatchFormation> = {
    0: "GK",
    1: "DEF",
    2: "MID",
    3: "ATT"
  };
  const formation = formationByValue[value];

  if (!formation) {
    throw new Error(`Unsupported Sokker match formation: ${value}.`);
  }

  return formation;
}

export function hasMatchPlayerParticipation(input: MatchPlayerParticipationInput): boolean {
  return (
    input.timeIn > 0 ||
    input.timeOut > 0 ||
    (input.rating ?? 0) > 0 ||
    (input.timePlaying ?? 0) > 0 ||
    (input.timeDefending ?? 0) > 0
  );
}

export function classifyMatchPlayerRole(input: MatchPlayerParticipationInput): MatchPlayerRole {
  if (!hasMatchPlayerParticipation(input)) {
    return "SUBSTITUTE_UNUSED";
  }

  return input.timeIn > 0 ? "SUBSTITUTE_USED" : "STARTER";
}

export function calculateMatchPlayerMinutes(input: MatchPlayerParticipationInput): number {
  if (!hasMatchPlayerParticipation(input)) {
    return 0;
  }

  const startMinute = Math.max(0, input.timeIn);
  const endMinute = input.timeOut > 0 ? input.timeOut : 90;

  return Math.min(90, Math.max(0, endMinute - startMinute));
}

export function classifyMatchType(input: {
  isOfficial: boolean;
  name: string;
  type: number;
}): "OFFICIAL" | "FRIENDLY" | "NOT_ELIGIBLE" {
  if (input.isOfficial) {
    return "OFFICIAL";
  }

  if (input.type === 11 || input.name.trim().toLocaleLowerCase() === "arcade") {
    return "NOT_ELIGIBLE";
  }

  return "FRIENDLY";
}

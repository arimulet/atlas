import type { DevelopmentObjective } from "@atlas/domain";

export interface DevelopmentObjectiveIconProps {
  objective?: DevelopmentObjective | null;
}

export function DevelopmentObjectiveIcon({ objective }: DevelopmentObjectiveIconProps) {
  if (!objective) return null;

  const label = objective === "sportive" ? "Sportive" : "Financial";

  return (
    <span aria-label={`Saved development objective: ${label}`} role="img" title={label}>
      {objective === "sportive" ? "⚽" : "💰"}
    </span>
  );
}

import type { ReactElement } from "react";

export type PositionCode = "GK" | "DEF" | "MID" | "ATT";

export function normalizePositionCode(
  pos: string | number | null | undefined
): PositionCode | null {
  if (pos === null || pos === undefined) return null;
  if (typeof pos === "number") {
    return (["GK", "DEF", "MID", "ATT"][pos] as PositionCode) ?? null;
  }
  const clean = String(pos).trim().toUpperCase();
  if (clean === "GK" || clean === "DEF" || clean === "MID" || clean === "ATT") {
    return clean;
  }
  if (clean === "GOALKEEPER") return "GK";
  if (clean === "DEFENDER" || clean === "WING_DEFENDER") return "DEF";
  if (clean === "MIDFIELDER" || clean === "WINGER") return "MID";
  if (clean === "FORWARD" || clean === "ATTACKER" || clean === "STRIKER") return "ATT";
  return null;
}

export interface PositionBadgeProps {
  position: string | number | null | undefined;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}

export function PositionBadge({
  position,
  size = "sm",
  className = "",
  title
}: PositionBadgeProps): ReactElement<{ className: string; title: string; children: string }> | null {
  if (position === null || position === undefined) {
    return null;
  }

  const normalized = normalizePositionCode(position);
  const rawString = String(position).trim();

  let modifierClass = "is-none";
  let displayText = rawString;

  if (normalized) {
    modifierClass = `is-${normalized.toLowerCase()}`;
    displayText = normalized;
  } else if (rawString.toUpperCase() === "RELEASE") {
    modifierClass = "is-release";
    displayText = "RELEASE";
  } else if (rawString.toUpperCase() === "UNKNOWN") {
    modifierClass = "is-unknown";
    displayText = "UNKNOWN";
  }

  const sizeClass = `atlas-position-badge--${size}`;
  const classes = ["atlas-position-badge", sizeClass, modifierClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} title={title ?? displayText}>
      {displayText}
    </span>
  );
}

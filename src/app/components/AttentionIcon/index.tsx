import type { Severity } from "@atlas/web/app/types";

interface AttentionIconProps {
  severity: Severity;
}

export function AttentionIcon({ severity }: AttentionIconProps) {
  return (
    <span className={`atlas-attention-icon is-${severity}`} aria-hidden="true">
      {severity === "info" || severity === "low" ? "\u2139" : "\u26A0"}
    </span>
  );
}

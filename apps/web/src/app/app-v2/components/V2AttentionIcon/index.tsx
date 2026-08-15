import type { Severity } from "@atlas/web/app/types";

interface V2AttentionIconProps {
  severity: Severity;
}

export function V2AttentionIcon({ severity }: V2AttentionIconProps) {
  return (
    <span className={`v2-attention-icon is-${severity}`} aria-hidden="true">
      {severity === "info" || severity === "low" ? "\u2139" : "\u26A0"}
    </span>
  );
}

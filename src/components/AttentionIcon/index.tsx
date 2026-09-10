import type { Severity } from "@atlas/web/app/types";
import { AlertTriangle, Info } from "lucide-react";

interface AttentionIconProps {
  severity: Severity;
}

export function AttentionIcon({ severity }: AttentionIconProps) {
  return (
    <span className={`atlas-attention-icon is-${severity}`} aria-hidden="true">
      {severity === "info" || severity === "low" ? (
        <Info size={16} />
      ) : (
        <AlertTriangle size={16} />
      )}
    </span>
  );
}

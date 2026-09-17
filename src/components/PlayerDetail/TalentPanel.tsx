import type { PlayerDetailViewModel } from "@/app/view-models/player-detail-view-model";
import { formatTalent } from "@/app/formatters";

interface TalentPanelProps {
  talent: PlayerDetailViewModel["talent"];
}

export function TalentPanel({ talent }: TalentPanelProps) {
  if (talent.estimated === null) {
    return (
      <p className="atlas-player-detail__talent-summary atlas-player-detail__message">
        <strong>Talent</strong>
        <span>Not enough training history to estimate.</span>
      </p>
    );
  }

  const confidenceConfig = getConfidenceBadgeConfig(talent.confidence);

  return (
    <p className="atlas-player-detail__talent-summary" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
      <strong>Talent {formatTalent(talent.estimated)}</strong>
      {talent.confidence ? (
        <span
          className="atlas-talent-badge"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 8px",
            borderRadius: "var(--atlas-radius-sm, 4px)",
            fontSize: "0.72rem",
            fontWeight: 600,
            textTransform: "capitalize",
            backgroundColor: confidenceConfig.bg,
            color: confidenceConfig.color,
            border: `1px solid ${confidenceConfig.border}`
          }}
        >
          {talent.confidence} confidence
        </span>
      ) : null}
      {talent.observations !== undefined ? (
        <span className="atlas-text-muted" style={{ fontSize: "0.82rem" }}>
          ({talent.observations} complete training cycles)
        </span>
      ) : null}
    </p>
  );
}

function getConfidenceBadgeConfig(confidence?: string) {
  switch (confidence) {
    case "high":
      return {
        bg: "rgba(16, 185, 129, 0.12)",
        color: "var(--atlas-success, #059669)",
        border: "rgba(16, 185, 129, 0.3)"
      };
    case "medium":
      return {
        bg: "rgba(37, 99, 235, 0.12)",
        color: "var(--atlas-accent, #2563eb)",
        border: "rgba(37, 99, 235, 0.3)"
      };
    case "low":
      return {
        bg: "rgba(217, 119, 6, 0.12)",
        color: "var(--atlas-warning, #d97706)",
        border: "rgba(217, 119, 6, 0.3)"
      };
    default:
      return {
        bg: "rgba(107, 114, 128, 0.12)",
        color: "var(--atlas-text-muted, #6b7280)",
        border: "rgba(107, 114, 128, 0.3)"
      };
  }
}

import type { PlayerDetailViewModel } from "../../view-models/player-detail-view-model";
import { formatTalent } from "../../formatters";

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

  return (
    <p className="atlas-player-detail__talent-summary">
      <strong>Talent {formatTalent(talent.estimated)}</strong>
      {talent.confidence ? <span>{talent.confidence} confidence</span> : null}
      {talent.observations !== undefined ? (
        <span>{talent.observations} complete training cycles</span>
      ) : null}
    </p>
  );
}

import type { PlayerDetailViewModel } from "../../view-models/player-detail-view-model";

interface TalentPanelProps {
  talent: PlayerDetailViewModel["talent"];
}

export function TalentPanel({ talent }: TalentPanelProps) {
  return (
    <section className="v2-player-detail-panel" aria-labelledby="player-detail-talent-title">
      <h2 className="v2-player-detail-panel__title" id="player-detail-talent-title">
        Talent
      </h2>
      {talent.estimated === null ? (
        <p className="v2-player-detail__message">
          Not enough training history to estimate talent.
        </p>
      ) : (
        <dl className="v2-player-detail__data-list">
          <div className="v2-player-detail__data-list-row--primary">
            <dt>Estimated talent</dt>
            <dd>{formatTalent(talent.estimated)}</dd>
          </div>
          {talent.confidence !== undefined ? (
            <div>
              <dt>Confidence</dt>
              <dd>{talent.confidence}</dd>
            </div>
          ) : null}
          {talent.observations !== undefined ? (
            <div>
              <dt>Observations</dt>
              <dd>{talent.observations}</dd>
            </div>
          ) : null}
          {talent.updatedAt !== undefined ? (
            <div>
              <dt>Last update</dt>
              <dd>{talent.updatedAt}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function formatTalent(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

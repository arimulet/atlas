import type { TrainingPageData, TrainingReport } from "@atlas/web/app/types";

interface RecentTrainingProgressModalProps {
  history: TrainingReport[];
  isOpen: boolean;
  onClose: () => void;
  players: TrainingPageData["players"];
}

export function RecentTrainingProgressModal({
  history,
  isOpen,
  onClose,
  players
}: RecentTrainingProgressModalProps) {
  if (!isOpen) return null;

  const latestGameWeek = history.reduce<number | null>(
    (latest, report) => Math.max(latest ?? report.gameWeek, report.gameWeek),
    null
  );
  const playerNames = new Map(players.map((player) => [String(player.playerId), player.name]));
  const changes =
    latestGameWeek === null
      ? []
      : history
          .filter((report) => report.gameWeek === latestGameWeek)
          .flatMap((report) =>
            (report.skillChanges ?? []).map((change) => ({
              key: `${report.playerId}-${change.skill}`,
              playerName: playerNames.get(String(report.playerId)) ?? String(report.playerId),
              skill: change.skill,
              delta: change.delta
            }))
          )
          .reverse();

  return (
    <div className="atlas-training-progress-modal__backdrop" role="presentation">
      <section
        aria-labelledby="recent-progress-title"
        aria-modal="true"
        className="atlas-training-progress-modal"
        role="dialog"
      >
        <div className="atlas-training-progress-modal__header">
          <div>
            <span>Training</span>
            <h2 id="recent-progress-title">Recent Progress</h2>
          </div>
          <button aria-label="Close recent progress" onClick={onClose} type="button">
            ×
          </button>
        </div>
        {changes.length === 0 ? (
          <p>No skill changes detected in the latest week.</p>
        ) : (
          <ul>
            {changes.map((change) => (
              <li className={change.delta > 0 ? "is-skill-up" : "is-skill-down"} key={change.key}>
                <strong>{change.playerName}</strong>
                <span>
                  {change.skill} {change.delta > 0 ? "+" : ""}
                  {change.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

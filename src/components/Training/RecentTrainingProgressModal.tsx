import { X } from "lucide-react";
import type { TrainingPageData, TrainingReport } from "@atlas/web/app/types";
import { PlayerLink } from "@/components/PlayerLink";

interface RecentTrainingProgressModalProps {
  history: TrainingReport[];
  isOpen: boolean;
  onClose: () => void;
  players: TrainingPageData["players"];
  onSelectPlayer?: (playerId: string) => void;
}

export function RecentTrainingProgressModal({
  history,
  isOpen,
  onClose,
  players,
  onSelectPlayer
}: RecentTrainingProgressModalProps) {
  if (!isOpen) return null;

  const latestGameWeek = history.reduce<number | null>(
    (latest, report) => Math.max(latest ?? report.gameWeek, report.gameWeek),
    null
  );

  const playerById = new Map(players.map((player) => [String(player.playerId), player]));

  const reportsForWeek =
    latestGameWeek === null
      ? []
      : history.filter((report) => report.gameWeek === latestGameWeek);

  const playerChangesMap = new Map<
    string,
    {
      playerId: string;
      playerName: string;
      countryName: string | null;
      age: number | null;
      changes: Array<{ skill: string; delta: number }>;
    }
  >();

  for (const report of reportsForWeek) {
    const rawChanges = (report.skillChanges ?? []).filter((change) => change.delta !== 0);
    if (rawChanges.length === 0) continue;

    const id = String(report.playerId);
    const player = playerById.get(id);
    const existing = playerChangesMap.get(id);

    if (existing) {
      for (const change of rawChanges) {
        const existingChange = existing.changes.find((c) => c.skill === change.skill);
        if (existingChange) {
          existingChange.delta += change.delta;
        } else {
          existing.changes.push({ skill: change.skill, delta: change.delta });
        }
      }
    } else {
      playerChangesMap.set(id, {
        playerId: id,
        playerName: player?.name ?? String(report.playerId),
        countryName: player?.countryName ?? null,
        age: player?.age ?? report.age ?? null,
        changes: rawChanges.map((c) => ({ skill: c.skill, delta: c.delta }))
      });
    }
  }

  const playerChanges = Array.from(playerChangesMap.values())
    .map((item) => ({
      ...item,
      changes: item.changes.filter((c) => c.delta !== 0)
    }))
    .filter((item) => item.changes.length > 0)
    .reverse();

  const handleSelectPlayer = (selectedPlayerId: string) => {
    onClose();
    if (onSelectPlayer) {
      onSelectPlayer(selectedPlayerId);
    }
  };

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
            <X size={16} />
          </button>
        </div>
        {playerChanges.length === 0 ? (
          <p>No skill changes detected in the latest week.</p>
        ) : (
          <ul>
            {playerChanges.map((item) => (
              <li key={item.playerId}>
                <div className="atlas-training-progress-modal__player">
                  <PlayerLink
                    countryName={item.countryName}
                    playerId={item.playerId}
                    onSelectPlayer={handleSelectPlayer}
                  >
                    {item.playerName}
                  </PlayerLink>
                  {item.age !== null && item.age !== undefined ? (
                    <span className="atlas-training-progress-modal__age">({item.age})</span>
                  ) : null}
                </div>
                <span className="atlas-training-progress-modal__changes">
                  {item.changes.map((change, index) => (
                    <span key={`${item.playerId}-${change.skill}-${index}`}>
                      {index > 0 ? ", " : ""}
                      <span className={change.delta > 0 ? "is-skill-up" : "is-skill-down"}>
                        {change.skill} {change.delta > 0 ? `+${change.delta}` : change.delta}
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

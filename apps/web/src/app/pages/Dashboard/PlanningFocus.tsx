import { PlayerLink } from "../../components/PlayerLink";
import type { SquadPriorityActionViewModel } from "../Squad/squad-planning-view-model";

interface PlanningFocusProps {
  actions: readonly SquadPriorityActionViewModel[];
  onSelectPlayer: (playerId: string) => void;
}

export function PlanningFocus({ actions, onSelectPlayer }: PlanningFocusProps) {
  return (
    <section
      className="atlas-dashboard-panel atlas-dashboard-panel--planning-actions"
      aria-labelledby="dashboard-planning-focus-title"
    >
      <div className="atlas-dashboard-panel__heading">
        <div>
          <span className="atlas-dashboard-planning__eyebrow">Planning focus</span>
          <h2 id="dashboard-planning-focus-title" className="atlas-dashboard-panel__title">
            Priority Actions
          </h2>
        </div>
        {actions.length === 0 ? (
          <span className="atlas-dashboard-planning__quiet">
            No high-priority actions detected.
          </span>
        ) : null}
      </div>
      {actions.length === 0 ? (
        <p className="atlas-dashboard-panel__message is-quiet">
          Squad structure is currently healthy.
        </p>
      ) : (
        <div className="atlas-dashboard-actions-grid">
          {actions.map((action) => (
            <article
              className={"atlas-dashboard-recommendation is-" + action.priority}
              key={action.id}
            >
              <div className="atlas-dashboard-recommendation__meta">
                <span className={"atlas-dashboard-planning-badge is-" + action.priority}>
                  {action.priority}
                </span>
                <span>{action.horizonLabel}</span>
                <span>{action.confidence} confidence</span>
              </div>
              <h3>{action.profileLabel}</h3>
              <strong>{action.title}</strong>
              <p>{action.description}</p>
              {action.playerIds.length > 0 ? (
                <div className="atlas-dashboard-recommendation__players">
                  {action.playerIds.map((playerId) => (
                    <PlayerLink key={playerId} playerId={playerId} onSelectPlayer={onSelectPlayer}>
                      {action.candidates.find((candidate) => candidate.playerId === playerId)
                        ?.playerName ?? `Player ${playerId}`}
                    </PlayerLink>
                  ))}
                </div>
              ) : null}
              <details>
                <summary>Why</summary>
                <ul>
                  {action.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

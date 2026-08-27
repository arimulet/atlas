import { YouthDecisionSections } from "../Youth/YouthDecisionSections";
import { useYouthDecisionEngine } from "../Youth/useYouthDecisionEngine";

interface PlayerDecisionsProps {
  clubId: string | null;
  currency: string | null;
  onSelectPlayer: (playerId: string) => void;
}

export function PlayerDecisions({ clubId, currency, onSelectPlayer }: PlayerDecisionsProps) {
  const decisionEngine = useYouthDecisionEngine({ clubId, currency, youthAcademy: null });

  return (
    <div className="atlas-player-decisions">
      <header className="atlas-player-decisions__header">
        <h1>Player Decisions</h1>
      </header>
      <YouthDecisionSections
        models={decisionEngine.decisionCandidates}
        onSelectPlayer={onSelectPlayer}
        status={decisionEngine.status}
      />
    </div>
  );
}

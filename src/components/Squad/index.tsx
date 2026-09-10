import { useMemo, useState, type ReactNode } from "react";
import type { TrainingPageData } from "@atlas/web/app/types";
import { formatTrainingPriority } from "@/app/formatters";
import type { SquadProps } from "./types";
import { createSquadMarketValueSummary } from "@/app/view-models/market-value-view-model";
import {
  TRAINING_POSITIONS,
  type TrainingPositionCode
} from "@/app/view-models/training-view-model";
import { recommendationLabel } from "@/components/Training/training-intelligence-view-model";
import { useWeeklyTrainingIntelligence } from "@/components/Training/useWeeklyTrainingIntelligence";
import { RecentTrainingProgressModal } from "@/components/Training/RecentTrainingProgressModal";
import { TrainingPlayerTables } from "@/components/Training/TrainingPlayerTables";
export { SquadPlanningRoleControl } from "./SquadPlanningRoleControl";

export function Squad({
  clubId,
  currency,
  development,
  onSaveSquadRole,
  onSelectPlayer,
  projectionSummaries,
  squadPlanning,
  squadPlanningStatus: _squadPlanningStatus,
  training,
  trainingDiagnostic,
  trainingStatus
}: SquadProps) {
  const [isRecentProgressOpen, setIsRecentProgressOpen] = useState(false);
  const weeklyTrainingIntelligence = useWeeklyTrainingIntelligence(
    clubId ?? development?.clubId ?? null
  );
  const recommendations = useMemo(
    () =>
      new Map(
        (weeklyTrainingIntelligence.data?.recommendations ?? []).map((recommendation) => [
          String(recommendation.playerId),
          recommendationLabel(recommendation)
        ])
      ),
    [weeklyTrainingIntelligence.data?.recommendations]
  );

  const marketSummary = createSquadMarketValueSummary(
    squadPlanning?.assessment.depthPlayers ?? [],
    currency
  );

  return (
    <div className="atlas-squad">
      <header className="atlas-squad__header">
        <h1>Squad</h1>
        <button
          className="atlas-training__recent-progress-button"
          onClick={() => setIsRecentProgressOpen(true)}
          type="button"
        >
          View Recent Progress
        </button>
      </header>

      <div className="atlas-squad__overview">
        <SquadMarketSummary summary={marketSummary} />
        <TrainingConfiguration configuration={training?.configuration ?? null} />
      </div>

      {trainingStatus === "ready" ? (
        <TrainingPlayerTables
          configuration={training?.configuration ?? null}
          currency={currency}
          diagnostic={trainingDiagnostic}
          history={training?.history ?? []}
          onSaveSquadRole={onSaveSquadRole}
          onSelectPlayer={onSelectPlayer}
          players={training?.players ?? []}
          projectionSummaries={projectionSummaries}
          recommendations={recommendations}
          squadPlanning={squadPlanning}
        />
      ) : trainingStatus === "loading" ? (
        <SquadMessage>Loading squad...</SquadMessage>
      ) : trainingStatus === "error" ? (
        <SquadMessage tone="error">Unable to load squad.</SquadMessage>
      ) : (
        <SquadMessage>Import a club snapshot to populate the squad.</SquadMessage>
      )}

      <RecentTrainingProgressModal
        history={training?.history ?? []}
        isOpen={isRecentProgressOpen}
        onClose={() => setIsRecentProgressOpen(false)}
        players={training?.players ?? []}
      />
    </div>
  );
}

function SquadMarketSummary({
  summary
}: {
  summary: ReturnType<typeof createSquadMarketValueSummary>;
}) {
  return (
    <section
      className="atlas-squad-panel atlas-squad-market-summary"
      aria-labelledby="squad-market-title"
    >
      <div className="atlas-squad-market-summary__heading">
        <div>
          <p className="atlas-squad-market-summary__eyebrow">Market Value</p>
          <h2 id="squad-market-title" className="atlas-squad-panel__title atlas-section-title">
            Squad asset overview
          </h2>
        </div>
        <span>
          {summary.coverage.valued}/{summary.coverage.total} players valued
        </span>
      </div>
      <div className="atlas-squad-market-summary__metrics">
        <SummaryMetric label="Current squad value" value={summary.currentTotal.label} />
        <SummaryMetric label="Projected at targets" value={summary.projectedTotal.label} />
        <SummaryMetric
          label="Potential value creation"
          value={summary.potentialValueCreation.label}
        />
        <SummaryMetric
          label="Comparable-backed"
          value={`${summary.coverage.comparableBacked} players`}
        />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="atlas-squad-market-summary__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface TrainingConfigurationProps {
  configuration: TrainingPageData["configuration"];
}

function TrainingConfiguration({ configuration }: TrainingConfigurationProps) {
  return (
    <section className="atlas-training-panel" aria-labelledby="training-configuration-title">
      <h2
        id="training-configuration-title"
        className="atlas-training-panel__title atlas-section-title"
      >
        Training Configuration
      </h2>
      {configuration ? (
        <div className="atlas-training-configuration">
          {TRAINING_POSITIONS.map((position: { code: TrainingPositionCode }) => (
            <div className="atlas-training-configuration__item" key={position.code}>
              <span className="atlas-training-position-badge">{position.code}</span>
              <strong>{skillLabel(configuration[position.code])}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="atlas-training-panel__message">Training configuration is not available.</p>
      )}
    </section>
  );
}

function skillLabel(skill: number | null): string {
  return skill === null ? "—" : formatTrainingPriority(skill);
}

interface SquadMessageProps {
  children: ReactNode;
  tone?: "error" | "quiet";
}

function SquadMessage({ children, tone }: SquadMessageProps) {
  return <p className={`atlas-squad-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

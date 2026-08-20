import type { ReactNode } from "react";
import { PlayerLink } from "../../components/PlayerLink";
import {
  mapYouthFitReason,
  type YouthDecisionMessage,
  type YouthDecisionViewModel
} from "./youth-decision-view-model";

interface YouthDecisionCardProps {
  model: YouthDecisionViewModel;
  onSelectPlayer: (playerId: string) => void;
}

export function YouthDecisionCard({ model, onSelectPlayer }: YouthDecisionCardProps) {
  const supportingReasons = model.candidate.opportunity.reasons.map(mapYouthFitReason);
  const showLowConfidenceWarning = model.confidence === "low" && model.decision !== "hold";
  const profileChanged = model.development.changedProfile;

  return (
    <article className={`atlas-youth-decision-card is-${model.decision}`}>
      <header className="atlas-youth-decision-card__header">
        <div>
          <h3 className="atlas-youth-decision-card__player">
            <PlayerLink playerId={model.playerId} onSelectPlayer={onSelectPlayer}>
              {model.playerName}
            </PlayerLink>
            <span>{model.age === null ? "Age unknown" : `· ${model.age}`}</span>
          </h3>
          <p className="atlas-youth-decision-card__profile">{model.profileLabel}</p>
        </div>
        <div className="atlas-youth-decision-card__decision" aria-label="ATLAS recommendation">
          <span className={`atlas-youth-decision-badge is-${model.decision}`}>
            {model.decisionLabel}
          </span>
          <span className="atlas-youth-decision-card__meta">
            {model.priorityLabel} · {model.confidenceLabel}
          </span>
        </div>
      </header>

      {showLowConfidenceWarning ? (
        <p className="atlas-youth-decision-card__confidence-warning">
          Recommendation may change as more evidence becomes available.
        </p>
      ) : null}

      <div className="atlas-youth-decision-card__why">
        <h4>Why</h4>
        <MessageList
          messages={model.primaryReasons.slice(0, 4)}
          emptyMessage="No decisive signals recorded."
        />
      </div>

      {model.risks.length > 0 ? (
        <div className="atlas-youth-decision-card__risks">
          <h4>Risks</h4>
          <MessageList messages={model.risks.slice(0, 3)} />
        </div>
      ) : null}

      <details className="atlas-youth-decision-card__details">
        <summary>Assessment details</summary>
        <div className="atlas-youth-decision-details">
          <DetailSection title="Prospect">
            <MetricRow label="Quality" value={model.prospectQualityLabel} />
            <MetricRow label="Development potential" value={model.developmentPotentialLabel} />
            <MetricRow label="Profile fit" value={model.profileCoherenceLabel} />
            <MessageGroup title="Strengths" messages={model.strengths} />
            <MessageGroup title="Weaknesses" messages={model.weaknesses} />
          </DetailSection>

          <DetailSection title="Club Fit">
            <MetricRow label="Club fit" value={model.clubFitLabel} />
            <MetricRow label="Future squad need" value={model.squadNeedLabel} />
            <MetricRow label="Succession fit" value={model.successionLabel} />
            <MetricRow label="Resource competition" value={model.resourceCompetitionLabel} />
            <MessageGroup title="Squad signals" messages={supportingReasons} />
          </DetailSection>

          <DetailSection title="Development">
            <MetricRow label="Opportunity" value={model.developmentOpportunityLabel} />
            <MetricRow
              label="Recommended profile"
              value={model.development.recommendedProfileLabel}
            />
            {profileChanged ? (
              <MetricRow
                label="Original profile"
                value={model.initialProfile ? model.profileLabel : "Unknown"}
              />
            ) : null}
            <MetricRow
              label="Target completion"
              value={formatWeeks(model.development.targetCompletionWeeks)}
            />
            <MetricRow
              label="Advanced training"
              value={`${capitalize(model.development.advancedOpportunity)}${model.development.advancedRank ? ` · #${model.development.advancedRank}` : ""}`}
            />
            {model.decision === "train" ? (
              <MetricRow label="Training priority" value={model.priorityLabel} />
            ) : null}
          </DetailSection>

          {model.succession ? (
            <DetailSection title="Succession">
              <MetricRow label="Outgoing players" value={String(model.succession.outgoingCount)} />
              <MetricRow
                label="Needed"
                value={formatGameWeek(model.succession.requiredReadyGameWeek)}
              />
              <MetricRow
                label="Projected ready"
                value={formatGameWeek(model.succession.projectedReadyGameWeek)}
              />
              <MetricRow label="Timing" value={model.succession.timingLabel} />
            </DetailSection>
          ) : null}

          {model.market ? (
            <DetailSection title="Market">
              <MetricRow label="Estimated current value" value={model.market.currentValueLabel} />
              <MetricRow
                label="Projected development value"
                value={model.market.projectedValueLabel}
              />
              <MetricRow
                label="Training value efficiency"
                value={`${model.market.trainingValuePerWeekLabel}/week`}
              />
              {model.decision === "sell" &&
              model.market.trainingValuePerWeek !== null &&
              model.market.trainingValuePerWeek > 0 ? (
                <p className="atlas-youth-decision-additional-signal">
                  Additional signal: a short training period may significantly increase market
                  value.
                </p>
              ) : null}
              <MetricRow
                label="Market confidence"
                value={model.market.confidence ? capitalize(model.market.confidence) : "Unknown"}
              />
              {model.market.comparableSales !== null ? (
                <MetricRow label="Comparable sales" value={String(model.market.comparableSales)} />
              ) : null}
            </DetailSection>
          ) : null}

          {model.resourceCompetition ? (
            <DetailSection title="Development resources">
              <MetricRow
                label="Advanced candidate"
                value={model.resourceCompetition.advancedOpportunity}
              />
              <MetricRow
                label="Projected rank"
                value={formatRank(model.resourceCompetition.advancedRank)}
              />
              {model.resourceCompetition.candidates !== null &&
              model.resourceCompetition.futureSlots !== null ? (
                <MetricRow
                  label="Pipeline capacity"
                  value={`${model.resourceCompetition.candidates} candidates · ${model.resourceCompetition.futureSlots} future slots`}
                />
              ) : null}
            </DetailSection>
          ) : null}
        </div>
      </details>
    </article>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="atlas-youth-decision-detail-section">
      <h5>{title}</h5>
      {children}
    </section>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="atlas-youth-decision-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MessageGroup({ title, messages }: { title: string; messages: YouthDecisionMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="atlas-youth-decision-message-group">
      <h6>{title}</h6>
      <MessageList messages={messages.slice(0, 3)} />
    </div>
  );
}

function MessageList({
  messages,
  emptyMessage
}: {
  messages: YouthDecisionMessage[];
  emptyMessage?: string;
}) {
  if (messages.length === 0 && emptyMessage)
    return <p className="atlas-youth-decision-empty">{emptyMessage}</p>;
  if (messages.length === 0) return null;
  return (
    <ul className="atlas-youth-decision-message-list">
      {messages.map((message, index) => (
        <li key={`${message.title}-${index}`}>
          <strong>{message.title}</strong>
          <span>{message.description}</span>
        </li>
      ))}
    </ul>
  );
}

function formatWeeks(value: number | null): string {
  return value === null ? "Unknown" : `~${Math.round(value)} weeks`;
}

function formatGameWeek(value: number | null): string {
  return value === null ? "Unknown" : `~GW ${value}`;
}

function formatRank(value: number | null): string {
  return value === null ? "Unknown" : `#${value}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

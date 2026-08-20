import { useMemo, useState, type ReactNode } from "react";

import { YouthDecisionCard } from "./YouthDecisionCard";
import {
  filterYouthDecisionViewModels,
  type YouthDecisionFilter,
  type YouthDecisionViewModel,
  type YouthSummaryViewModel
} from "./youth-decision-view-model";

interface YouthDecisionSectionsProps {
  models: YouthDecisionViewModel[];
  summary: YouthSummaryViewModel;
  onSelectPlayer: (playerId: string) => void;
  status: "idle" | "loading" | "ready" | "error";
}

export function YouthDecisionSections({
  models,
  summary,
  onSelectPlayer,
  status
}: YouthDecisionSectionsProps) {
  const [filter, setFilter] = useState<YouthDecisionFilter>("all");
  const filteredModels = useMemo(
    () => filterYouthDecisionViewModels(models, filter),
    [filter, models]
  );

  return (
    <>
      <YouthSummary summary={summary} />
      <section
        className="atlas-youth-panel atlas-youth-panel--decisions"
        aria-labelledby="youth-decisions-title"
      >
        <div className="atlas-youth-section-heading">
          <div>
            <p className="atlas-youth-panel__eyebrow">Decision Intelligence</p>
            <h2 id="youth-decisions-title" className="atlas-youth-panel__title atlas-section-title">
              Decision Required
            </h2>
          </div>
          <DecisionFilters filter={filter} onChange={setFilter} />
        </div>
        {status === "loading" ? (
          <DecisionMessage>Loading decision intelligence...</DecisionMessage>
        ) : null}
        {status === "error" ? (
          <DecisionMessage tone="error">
            Decision Intelligence is temporarily unavailable. Youth School remains available.
          </DecisionMessage>
        ) : null}
        {status === "idle" ? (
          <DecisionMessage>Import a club snapshot to evaluate promoted youth.</DecisionMessage>
        ) : null}
        {status === "ready" && filteredModels.length === 0 ? (
          <DecisionMessage>
            {models.length === 0
              ? "No youth decisions required right now."
              : "No candidates match this filter."}
          </DecisionMessage>
        ) : null}
        {status === "ready" && filteredModels.length > 0 ? (
          <div className="atlas-youth-decision-queue">
            {filteredModels.map((model) => (
              <YouthDecisionCard
                key={model.playerId}
                model={model}
                onSelectPlayer={onSelectPlayer}
              />
            ))}
          </div>
        ) : null}
      </section>
      {status === "ready" && models.length > 1 ? <YouthDecisionComparison models={models} /> : null}
    </>
  );
}

function YouthSummary({ summary }: { summary: YouthSummaryViewModel }) {
  return (
    <section className="atlas-youth-summary" aria-labelledby="youth-summary-title">
      <div>
        <p className="atlas-youth-summary__eyebrow">Youth Academy</p>
        <h2 id="youth-summary-title">{summary.academyPlayers} players in school</h2>
      </div>
      <div className="atlas-youth-summary__metrics">
        <SummaryMetric label="Decision candidates" value={String(summary.decisionCandidates)} />
        <SummaryMetric label="Train" value={String(summary.counts.train)} />
        <SummaryMetric label="Keep" value={String(summary.counts.keep)} />
        <SummaryMetric label="Sell" value={String(summary.counts.sell)} />
        <SummaryMetric label="Release" value={String(summary.counts.release)} />
        <SummaryMetric label="Hold" value={String(summary.counts.hold)} />
        <SummaryMetric
          label="High-priority decisions"
          value={String(summary.highPriorityDecisions)}
        />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="atlas-youth-summary__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DecisionFilters({
  filter,
  onChange
}: {
  filter: YouthDecisionFilter;
  onChange: (filter: YouthDecisionFilter) => void;
}) {
  const filters: Array<{ value: YouthDecisionFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "train", label: "Train" },
    { value: "keep", label: "Keep" },
    { value: "sell", label: "Sell" },
    { value: "release", label: "Release" },
    { value: "hold", label: "Hold" },
    { value: "high", label: "High priority" }
  ];
  return (
    <div className="atlas-youth-decision-filters" aria-label="Youth decision filters">
      {filters.map((item) => (
        <button
          className={filter === item.value ? "is-active" : ""}
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function YouthDecisionComparison({ models }: { models: YouthDecisionViewModel[] }) {
  return (
    <section
      className="atlas-youth-panel atlas-youth-panel--comparison"
      aria-labelledby="youth-comparison-title"
    >
      <div className="atlas-youth-section-heading">
        <div>
          <p className="atlas-youth-panel__eyebrow">Promoted players</p>
          <h2 id="youth-comparison-title" className="atlas-youth-panel__title atlas-section-title">
            Decision Comparison
          </h2>
        </div>
      </div>
      <div className="atlas-youth-table-wrap">
        <table className="atlas-youth-table atlas-youth-comparison-table">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Age</th>
              <th scope="col">Profile</th>
              <th scope="col">Prospect</th>
              <th scope="col">Club Fit</th>
              <th scope="col">Market</th>
              <th scope="col">Decision</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.playerId}>
                <th scope="row">{model.playerName}</th>
                <td>{model.age ?? "—"}</td>
                <td>{model.profileLabel}</td>
                <td>{model.prospectQualityLabel}</td>
                <td>{model.clubFitLabel}</td>
                <td>{model.market?.currentValueLabel ?? "—"}</td>
                <td>
                  <span className={`atlas-youth-decision-badge is-${model.decision}`}>
                    {model.decisionLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DecisionMessage({
  children,
  tone = "quiet"
}: {
  children: ReactNode;
  tone?: "quiet" | "error";
}) {
  return <p className={`atlas-youth-panel__message is-${tone}`}>{children}</p>;
}

import { Fragment, useMemo, useState, type ReactNode } from "react";

import { YouthDecisionCard } from "./YouthDecisionCard";
import {
  filterYouthDecisionViewModels,
  orderYouthDecisionComparisonModels,
  type YouthDecisionFilter,
  type YouthDecisionViewModel
} from "./youth-decision-view-model";

interface YouthDecisionSectionsProps {
  models: YouthDecisionViewModel[];
  onSelectPlayer: (playerId: string) => void;
  status: "idle" | "loading" | "ready" | "error";
}

export function YouthDecisionSections({
  models,
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
      {status === "ready" && models.length > 1 ? <YouthDecisionComparison models={models} /> : null}
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
    </>
  );
}

export function YouthSummary({ summary }: { summary: { academyPlayers: number } }) {
  return (
    <section className="atlas-youth-summary" aria-labelledby="youth-summary-title">
      <div>
        <p className="atlas-youth-summary__eyebrow">Youth Academy</p>
        <h2 id="youth-summary-title">{summary.academyPlayers} players in school</h2>
      </div>

    </section>
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
    { value: "unknown", label: "Unknown" },
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
  const comparisonModels = orderYouthDecisionComparisonModels(models);
  const firstExcludedIndex = comparisonModels.findIndex((model) => !isCurrentlyAdvanced(model));

  return (
    <section
      className="atlas-youth-panel atlas-youth-panel--comparison"
      aria-labelledby="youth-comparison-title"
    >
      <div className="atlas-youth-section-heading">
        <div>
          <p className="atlas-youth-panel__eyebrow">Player Decisions</p>
          <h2 id="youth-comparison-title" className="atlas-youth-panel__title atlas-section-title">
            Candidate Comparison
          </h2>
        </div>
      </div>
      {comparisonModels.some((model) => model.advancedTraining.isTrial) ? (
        <p className="atlas-youth-comparison-table__trial-note">
          ◌ Trial advanced is provisional and requires validation with real senior training weeks.
        </p>
      ) : null}
      <div className="atlas-youth-table-wrap">
        <table className="atlas-youth-table atlas-youth-comparison-table">
          <colgroup>
            <col className="atlas-youth-comparison-table__player-column" />
            <col className="atlas-youth-comparison-table__advanced-column" />
            <col className="atlas-youth-comparison-table__rank-column" />
            <col className="atlas-youth-comparison-table__age-column" />
            <col className="atlas-youth-comparison-table__profile-column" />
            <col className="atlas-youth-comparison-table__prospect-column" />
            <col className="atlas-youth-comparison-table__club-fit-column" />
            <col className="atlas-youth-comparison-table__market-column" />
            <col className="atlas-youth-comparison-table__decision-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Current slot</th>
              <th scope="col">Advanced rank</th>
              <th scope="col">Age</th>
              <th scope="col">Profile</th>
              <th scope="col">Prospect</th>
              <th scope="col">Club Fit</th>
              <th scope="col">Market</th>
              <th scope="col">Decision</th>
            </tr>
          </thead>
          <tbody>
            {comparisonModels.map((model, index) => (
              <Fragment key={model.playerId}>
                {index === firstExcludedIndex && firstExcludedIndex > 0 ? (
                  <tr className="atlas-youth-comparison-table__slot-divider">
                    <th colSpan={9} scope="rowgroup">
                      Outside the current advanced-training slots
                    </th>
                  </tr>
                ) : null}
                <tr className={model.advancedTraining.isTrial ? "is-trial" : undefined}>
                  <th scope="row">{model.playerName}</th>
                  <td className="atlas-youth-table__center">
                    <AdvancedTrainingSlotIcon model={model} />
                  </td>
                  <td className="atlas-youth-table__center">{formatAdvancedRank(model)}</td>
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
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function isCurrentlyAdvanced(model: YouthDecisionViewModel): boolean {
  return model.advancedTraining.currentlyAdvanced;
}

function formatAdvancedRank(model: YouthDecisionViewModel): string {
  return model.advancedTraining.comparisonRank === null
    ? "—"
    : `#${model.advancedTraining.comparisonRank}`;
}

function AdvancedTrainingSlotIcon({ model }: { model: YouthDecisionViewModel }) {
  const isCurrent = isCurrentlyAdvanced(model);
  const hasInsufficientTrialProfile = model.advancedTraining.profileViability === "below_minimum";
  const label = model.advancedTraining.isTrial
    ? "Trial advanced training: provisional recommendation pending real senior training weeks"
    : isCurrent
      ? "Currently assigned to an advanced-training slot"
      : hasInsufficientTrialProfile
        ? "Outside the advanced-training slots: the profile does not meet the minimum quality for a trial"
        : "Outside the current advanced-training slots";

  return (
    <span
      aria-label={label}
      className={`atlas-youth-comparison-table__advanced-slot-icon ${model.advancedTraining.isTrial ? "is-trial" : isCurrent ? "is-current" : "is-excluded"}`}
      role="img"
    >
      {model.advancedTraining.isTrial ? "◌" : isCurrent ? "✓" : "×"}
    </span>
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

import type { FinancialStrategyState } from "@/app/features/financialStrategy/useFinancialStrategy";
import { formatMoney } from "@/app/formatters";
import { useState } from "react";
import { DevelopmentTargetSkills } from "./DevelopmentTargetSkills";
import { ProjectedSkillsTooltip } from "./ProjectedSkillsTooltip";
import { buildProjectedSkillSnapshots } from "./projected-skills";
import { getMilestoneSeasonWeek } from "./milestone-calendar";

type Result = NonNullable<FinancialStrategyState["acquisitionResult"]>;

function formatAmount(amount: number | null, currency: string | null): string {
  return amount === null ? "—" : formatMoney({ amount, currency, isComplete: true });
}

function MarginAmount({ amount, currency }: { amount: number | null; currency: string | null }) {
  const className =
    amount === null || amount === 0 ? undefined : amount > 0 ? "is-profit" : "is-loss";
  const sign = amount === null || amount === 0 ? "" : amount > 0 ? "+" : "−";
  return (
    <span className={className}>
      {sign}
      {formatAmount(amount === null ? null : Math.abs(amount), currency)}
    </span>
  );
}

export function DevelopmentResults({
  result,
  currentGameWeek,
  onRecalculateTargets,
  isRecalculating
}: {
  result: Result;
  currentGameWeek: number | null;
  onRecalculateTargets: FinancialStrategyState["recalculateAcquisitionTargets"];
  isRecalculating: boolean;
}) {
  const [talentScenario, setTalentScenario] = useState<"high" | "normal" | "low">("normal");
  const money = (amount: number | null) => formatAmount(amount, result.currency);
  const { development: plan, roi } = result.talentScenarios[talentScenario];
  const skillSnapshots = buildProjectedSkillSnapshots(result.input.skills, plan?.steps ?? []);
  const hasComparablePrice = result.financial.marketPriceSource === "market_comparables";
  const coreCost = !hasComparablePrice
    ? null
    : plan?.coreWeek === null || plan?.coreWeek === undefined
      ? null
      : result.financial.amount + result.financial.weeklyWage * plan.coreWeek;
  return (
    <>
      <div
        className={`atlas-finances-simulator-overview-grid${hasComparablePrice && roi ? " has-resale" : ""}`}
      >
        <div className="atlas-finances-simulator-result-card is-overview">
          <div className="atlas-finances-simulator-result-header">
            <h3>Decision overview</h3>
          </div>
          <div className="atlas-finances-metric-grid">
            <div className="atlas-finances-metric">
              <span>Purchase estimate</span>
              <strong>
                {hasComparablePrice ? result.financial.amountFormatted : "Unavailable"}
              </strong>
              <small>
                {result.financial.marketPriceSource === "market_comparables"
                  ? `${result.financial.comparableCount} comparable transfers · ${result.financial.comparableConfidence} confidence · ${money(result.financial.comparablePriceLow)} – ${money(result.financial.comparablePriceHigh)}`
                  : "Low confidence: no comparable transfer estimate available"}
              </small>
            </div>
            <div className="atlas-finances-metric">
              <span>Weekly wage</span>
              <strong>{result.financial.weeklyWageFormatted}</strong>
              <small>{result.financial.isWageEstimated ? "Estimated" : "Known wage"}</small>
            </div>
            <div className="atlas-finances-metric">
              <span>Path to Core</span>
              <strong>
                {plan?.coreWeek != null
                  ? `${plan.coreWeek} weeks`
                  : plan
                    ? "Not determined in projection"
                    : "Unavailable"}
              </strong>
              <small>
                {plan?.coreAge != null
                  ? `Estimated age: ${plan.coreAge} · assumes sufficient stamina`
                  : "Incomplete or uncertain"}
              </small>
            </div>
            <div className="atlas-finances-metric">
              <span>Cost to Core</span>
              <strong>{money(coreCost)}</strong>
              <small>Purchase and estimated wages</small>
            </div>
          </div>
        </div>
        {hasComparablePrice && roi && (
          <div className="atlas-finances-simulator-result-card is-resale">
            <div className="atlas-finances-simulator-result-header">
              <h3>Resale after 2 seasons</h3>
            </div>
            <div className="atlas-acquisition-resale-grid">
              <div className="atlas-finances-metric atlas-acquisition-resale-option">
                <span>Current training</span>
                <strong>{money(roi.projectedValueSeason2)}</strong>
                <small>Estimated value</small>
                <div className="atlas-acquisition-resale-margin">
                  <small>Margin after purchase and wages</small>
                  <MarginAmount amount={roi.netMarginSeason2} currency={result.currency} />
                </div>
              </div>
              <div className="atlas-finances-metric atlas-acquisition-resale-option">
                <span>Proposed Core plan</span>
                <strong>{money(roi.proposedValueSeason2)}</strong>
                <small>Estimated value</small>
                <div className="atlas-acquisition-resale-margin">
                  <small>Margin after purchase and wages</small>
                  <MarginAmount
                    currency={result.currency}
                    amount={
                      roi.proposedValueSeason2 === null || roi.totalCostSeason2 === null
                        ? null
                        : roi.proposedValueSeason2 - roi.totalCostSeason2
                    }
                  />
                </div>
              </div>
            </div>
            <p className="atlas-finances-panel__note">
              Estimates exclude transaction fees and assume constant wages.
            </p>
          </div>
        )}
      </div>
      <div className="atlas-finances-simulator-result-card is-development">
        <div className="atlas-finances-simulator-result-header">
          <h3>Development plan towards Core</h3>
          <span className="atlas-finances-simulator-chip is-break_even">
            Conditional projection
          </span>
        </div>
        {plan ? (
          <>
            <p className="atlas-finances-panel__note">
              Current Squad Planning role: {plan.currentRole}. Core classification also depends on
              contribution and lifecycle.
            </p>
            <DevelopmentTargetSkills
              skills={result.talentScenarios.normal.development?.gaps ?? plan.gaps}
              onRecalculate={onRecalculateTargets}
              isRecalculating={isRecalculating}
            />
            <h4>Proposed training milestones</h4>
            <div className="atlas-acquisition-talent-selector">
              <div className="atlas-acquisition-talent-selector__heading">
                <span>Assumed talent</span>
                <small>
                  Hypothetical scenarios, not a measurement of the player&apos;s talent.
                </small>
              </div>
              <div
                className="atlas-acquisition-talent-selector__group"
                role="group"
                aria-label="Assumed talent"
              >
                {(["high", "normal", "low"] as const).map((scenario) => (
                  <button
                    key={scenario}
                    type="button"
                    className={`atlas-acquisition-talent-selector__button is-${scenario}`}
                    aria-pressed={talentScenario === scenario}
                    onClick={() => setTalentScenario(scenario)}
                  >
                    <span className="atlas-acquisition-talent-selector__dot" aria-hidden="true" />
                    {scenario === "high" ? "High" : scenario === "normal" ? "Normal" : "Low"}
                  </button>
                ))}
              </div>
            </div>
            {plan.steps.length ? (
              <div className="atlas-acquisition-table-wrap">
                <table className="atlas-acquisition-table">
                  <thead>
                    <tr>
                      <th scope="col">Age / season week</th>
                      <th scope="col">Skill</th>
                      <th scope="col">Level</th>
                      <th scope="col">Projected skills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.steps.map((step, index) => {
                      const seasonWeek = getMilestoneSeasonWeek(
                        step.seasonWeek,
                        step.week,
                        currentGameWeek
                      );
                      const calendarLabel = seasonWeek === null ? undefined : `week ${seasonWeek}`;
                      return (
                        <tr key={`${step.skill}-${step.level}-${index}`}>
                          <td>
                            {step.age ?? "—"} y/o · {calendarLabel ?? "season week unavailable"}
                          </td>
                          <th scope="row">
                            {step.skill}
                            {step.residualChanges.length > 0 && (
                              <div className="atlas-finances-panel__note">
                                General: {step.residualChanges.map((change) => `${change.skill} ${change.level}`).join(", ")}
                              </div>
                            )}
                          </th>
                          <td>{step.level}</td>
                          <td>
                            <ProjectedSkillsTooltip
                              skills={skillSnapshots[index] ?? {}}
                              week={step.week}
                              calendarLabel={calendarLabel}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="atlas-finances-panel__note">
                No skill changes are projected within the available horizon.
              </p>
            )}
            <p className="atlas-finances-panel__note">
              Current club training: {result.training.trainedSkillName ?? "not configured"}.{" "}
              {plan.currentTrainingSteps.length
                ? `${plan.currentTrainingSteps.filter((step) => step.week <= 26).length} skill increases projected in 26 weeks.`
                : "No progress projected."}{" "}
              Advanced slots: {result.training.activeAdvancedSlotsCount}/10 occupied.
            </p>
            <p className="atlas-finances-panel__note">{plan.assumptions}</p>
          </>
        ) : (
          <p className="atlas-finances-panel__note">
            Development projection unavailable: age and relevant skill levels are required.
          </p>
        )}
      </div>
    </>
  );
}

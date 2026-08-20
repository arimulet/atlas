import type {
  AdvancedImpactViewModel,
  MarketComparableViewModel,
  PlayerMarketValueViewModel,
  ProjectionPointViewModel,
  TrainingValueViewModel
} from "../../view-models/market-value-view-model";

interface PlayerMarketValueSectionProps {
  marketValue: PlayerMarketValueViewModel | null;
}

export function PlayerMarketValueSection({ marketValue }: PlayerMarketValueSectionProps) {
  return (
    <section
      className="atlas-player-detail-panel atlas-market-value"
      aria-labelledby="market-value-title"
    >
      <div className="atlas-market-value__heading">
        <div>
          <p className="atlas-market-value__eyebrow">Market Value</p>
          <h2 className="atlas-player-detail-panel__title" id="market-value-title">
            Current market estimate
          </h2>
        </div>
        {marketValue ? <ConfidenceBadge confidence={marketValue.current.confidence} /> : null}
      </div>
      {!marketValue ? (
        <p className="atlas-player-detail__message">Insufficient data to estimate market value.</p>
      ) : (
        <>
          <MarketValueSummary marketValue={marketValue} />
          <MarketEvidence evidence={marketValue.evidence} />
          <MarketProjection projection={marketValue.projection} />
          <TrainingValueEfficiency training={marketValue.training} />
          <AdvancedTrainingImpact impact={marketValue.advancedImpact} />
        </>
      )}
    </section>
  );
}

function MarketValueSummary({ marketValue }: { marketValue: PlayerMarketValueViewModel }) {
  return (
    <div className="atlas-market-value__summary">
      <div className="atlas-market-value__primary">
        <span>Estimated Market Value</span>
        <strong>{marketValue.current.expected.label}</strong>
        <small>{marketValue.current.range.label}</small>
      </div>
      <dl className="atlas-market-value__facts">
        <div>
          <dt>Sokker Value</dt>
          <dd>{marketValue.current.sokkerValue?.label ?? "—"}</dd>
        </div>
        <div>
          <dt>Fundamental estimate</dt>
          <dd>{marketValue.current.fundamental.label}</dd>
        </div>
        <div>
          <dt>Calibrated estimate</dt>
          <dd>{marketValue.current.calibrated.label}</dd>
        </div>
      </dl>
      <p className="atlas-market-value__note">
        {marketValue.current.basedOnFundamentalOnly
          ? "Based on fundamental valuation · Limited market evidence"
          : "ATLAS Market Value estimates expected transfer-market value; Sokker Value is nominal."}
      </p>
      {marketValue.reasons.length > 0 ? (
        <div className="atlas-market-value__drivers">
          <h3>Value drivers</h3>
          <ul>
            {marketValue.reasons.slice(0, 5).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MarketEvidence({ evidence }: { evidence: PlayerMarketValueViewModel["evidence"] }) {
  return (
    <div className="atlas-market-value__section">
      <SectionHeading eyebrow="Market Evidence" title="Comparable sales" />
      {evidence.sampleSize === 0 ? (
        <p className="atlas-player-detail__message atlas-player-detail__message--quiet">
          No comparable sales available. The fundamental model remains active.
        </p>
      ) : (
        <>
          <div className="atlas-market-value__evidence-summary">
            <strong>{evidence.sampleSize} comparable sales</strong>
            <span>{evidence.strongMatches} strong matches</span>
            <ConfidenceBadge confidence={evidence.confidence} />
          </div>
          <div className="atlas-market-value__evidence-range">
            <DataMetric label="Comparable estimate" value={evidence.estimate?.label ?? "—"} />
            <DataMetric
              label="Observed sale range"
              value={
                evidence.observedRange
                  ? `${evidence.observedRange.low.label} – ${evidence.observedRange.high.label}`
                  : "—"
              }
            />
            <DataMetric label="Weighted median" value={evidence.weightedMedian?.label ?? "—"} />
          </div>
          {evidence.outliersExcluded > 0 ? (
            <p className="atlas-market-value__diagnostic">
              {evidence.outliersExcluded} sale{evidence.outliersExcluded === 1 ? "" : "s"} excluded
              as price outlier
              {evidence.outliersExcluded === 1 ? "" : "s"}.
            </p>
          ) : null}
          <details className="atlas-market-value__comparables">
            <summary>View comparables</summary>
            <ComparableTable comparables={evidence.comparables} />
          </details>
        </>
      )}
    </div>
  );
}

function ComparableTable({ comparables }: { comparables: MarketComparableViewModel[] }) {
  const visible = comparables.filter((comparable) => !comparable.isOutlier);
  if (visible.length === 0) {
    return <p className="atlas-player-detail__message">No normal comparable sales to display.</p>;
  }
  return (
    <div className="atlas-player-detail__table-wrap">
      <table className="atlas-player-detail__table atlas-market-value__comparable-table">
        <thead>
          <tr>
            <th scope="col">Age</th>
            <th scope="col">Profile</th>
            <th scope="col">Key skills</th>
            <th scope="col">Similarity</th>
            <th scope="col">Sale</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((comparable) => (
            <tr key={`${comparable.age}-${comparable.date}-${comparable.salePrice.value}`}>
              <td colSpan={6}>
                <details className="atlas-market-value__comparable-detail">
                  <summary>
                    <span>{comparable.age}</span>
                    <span>{comparable.profile}</span>
                    <span>{comparable.keySkills}</span>
                    <span>{comparable.similarity}</span>
                    <span>{comparable.salePrice.label}</span>
                    <span>{comparable.date}</span>
                  </summary>
                  {comparable.differences.length > 0 ? (
                    <ul>
                      {comparable.differences.map((difference) => (
                        <li key={difference}>{difference}</li>
                      ))}
                    </ul>
                  ) : (
                    <small>No material differences identified.</small>
                  )}
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketProjection({
  projection
}: {
  projection: PlayerMarketValueViewModel["projection"];
}) {
  if (!projection) return null;
  return (
    <div className="atlas-market-value__section">
      <SectionHeading eyebrow="Market Projection" title="Development value timeline" />
      <div className="atlas-market-value__timeline-summary">
        <DataMetric label="Current" value={projection.current.label} />
        <DataMetric label="Next skill-up" value={projection.nextSkillUp?.value.label ?? "—"} />
        <DataMetric
          label="Development target"
          value={projection.targetCompletion?.value.label ?? "—"}
        />
        {projection.peak ? (
          <DataMetric
            label="Projected peak"
            value={`${projection.peak.value.label} · Age ${projection.peak.age}`}
          />
        ) : null}
      </div>
      <MarketProjectionChart points={projection.points} />
      <div className="atlas-market-value__projection-list">
        {projection.points.map((point) => (
          <ProjectionRow point={point} key={point.step} />
        ))}
        {projection.targetCompletion &&
        projection.targetCompletion.step !== projection.points.at(-1)?.step ? (
          <ProjectionRow point={projection.targetCompletion} key="completion" />
        ) : null}
      </div>
    </div>
  );
}

function MarketProjectionChart({ points }: { points: ProjectionPointViewModel[] }) {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? 300 : 24 + (index / (points.length - 1)) * 552,
    y: 132 - ((point.value.value - min) / spread) * 104
  }));
  return (
    <div className="atlas-market-value__chart-wrap">
      <svg
        className="atlas-market-value__chart"
        role="img"
        aria-label="Estimated market value versus development timeline"
        viewBox="0 0 600 160"
      >
        <line x1="24" y1="132" x2="576" y2="132" />
        <polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} />
        {coordinates.map((point, index) => (
          <circle cx={point.x} cy={point.y} r="4" key={points[index]!.step} />
        ))}
      </svg>
    </div>
  );
}

function ProjectionRow({ point }: { point: ProjectionPointViewModel }) {
  return (
    <div className="atlas-market-value__projection-row">
      <div>
        <strong>{point.label}</strong>
        <small>
          {point.age} years ·{" "}
          {point.weeks === null
            ? "—"
            : `~${point.weeks.toLocaleString("en-US", { maximumFractionDigits: 1 })}w`}{" "}
          · {point.confidence.label}
        </small>
        {point.range ? <small>{point.range.label}</small> : null}
      </div>
      <strong>{point.value.label}</strong>
      <span>{point.gainFromCurrent?.label ?? "—"}</span>
    </div>
  );
}

function TrainingValueEfficiency({ training }: { training: TrainingValueViewModel | null }) {
  if (!training) return null;
  return (
    <div className="atlas-market-value__section">
      <SectionHeading
        eyebrow="Training Value Efficiency"
        title="Economic return of the current plan"
      />
      <div className="atlas-market-value__training-summary">
        <DataMetric label="Expected value created" value={training.totalValueGain?.label ?? "—"} />
        <DataMetric label="Training time" value={training.totalTrainingWeeks} />
        <DataMetric
          label="Average value gain"
          value={training.averageValueGainPerWeek?.label ?? "—"}
        />
      </div>
      {training.negativeReturn ? (
        <p className="atlas-market-value__warning">
          Negative market-value return: the expected age discount outweighs the value added by a
          skill-up.
        </p>
      ) : null}
      {training.diminishingReturn ? (
        <p className="atlas-market-value__diagnostic">{training.diminishingReturn}</p>
      ) : null}
      <div className="atlas-market-value__table-wrap">
        <table className="atlas-player-detail__table">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Training</th>
              <th scope="col">Time</th>
              <th scope="col">Value gain</th>
              <th scope="col">Gain / week</th>
            </tr>
          </thead>
          <tbody>
            {training.steps.map((step) => (
              <tr key={step.step}>
                <th scope="row">{step.step}</th>
                <td>{step.label}</td>
                <td>{step.estimatedWeeks}</td>
                <td>{step.valueGain?.label ?? "—"}</td>
                <td>{step.valueGainPerWeek?.label ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="atlas-market-value__note">
        Market efficiency is informational and does not change the sporting plan.
      </p>
    </div>
  );
}

function AdvancedTrainingImpact({ impact }: { impact: AdvancedImpactViewModel | null }) {
  if (!impact) return null;
  return (
    <div className="atlas-market-value__section">
      <SectionHeading
        eyebrow="Advanced Training Impact"
        title="Economic value of the advanced slot"
      />
      {impact.horizonWeeks !== null ? (
        <div className="atlas-market-value__training-summary">
          <DataMetric
            label={`After ${impact.horizonWeeks} weeks · Advanced`}
            value={impact.advancedValue?.label ?? "—"}
          />
          <DataMetric label="Formation" value={impact.formationValue?.label ?? "—"} />
          <DataMetric label="Advanced slot value" value={impact.advancedSlotValue?.label ?? "—"} />
        </div>
      ) : null}
      <p className="atlas-market-value__note">
        This explains economic impact only; it does not replace the Advanced Training Slot
        Optimizer.
      </p>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="atlas-market-value__section-heading">
      <p className="atlas-market-value__eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: { level: string; label: string } }) {
  return (
    <span className={`atlas-market-value__confidence is-${confidence.level}`}>
      {confidence.label}
    </span>
  );
}

function DataMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="atlas-market-value__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

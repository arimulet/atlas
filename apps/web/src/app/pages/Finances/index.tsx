"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Info } from "lucide-react";
import { formatMoney } from "../../formatters";
import { PlayerLink } from "../../components/PlayerLink";
import { StatusBadge } from "../../components/StatusBadge";
import type { FinancesProps } from "./types";
import type { FinancialStrategyState } from "../../features/financialStrategy/useFinancialStrategy";

export function Finances({
  dashboard,
  onSelectPlayer,
  squadPlanning,
  status,
  financialStrategy
}: FinancesProps) {
  return (
    <div className="atlas-finances">
      <header className="atlas-finances__header">
        <h1>Finances</h1>
      </header>
      {financialStrategy?.status === "loading" ? (
        <PanelMessage>Loading financial strategy...</PanelMessage>
      ) : null}
      {financialStrategy?.status === "error" ? (
        <PanelMessage tone="error">
          Financial Strategy is temporarily unavailable. Basic cash data remains available.
        </PanelMessage>
      ) : null}
      <FinancialPositionSection
        dashboard={dashboard}
        financialStrategy={financialStrategy}
        status={status}
      />
      <CapitalCapacitySection financialStrategy={financialStrategy} />
      <InvestmentSimulator financialStrategy={financialStrategy} />
      <StrategicRecommendationsSection
        financialStrategy={financialStrategy}
        onSelectPlayer={onSelectPlayer}
      />
      <FundingPlanSection financialStrategy={financialStrategy} />
      <SquadAssetsSection financialStrategy={financialStrategy} onSelectPlayer={onSelectPlayer} />

      <ConflictsSection financialStrategy={financialStrategy} onSelectPlayer={onSelectPlayer} />
      {squadPlanning === null && status === "ready" ? (
        <PanelMessage>
          Squad Planning is not available. Financial position and cash capacity remain visible.
        </PanelMessage>
      ) : null}
    </div>
  );
}

function FinancialPositionSection({
  dashboard,
  financialStrategy,
  status
}: {
  dashboard: FinancesProps["dashboard"];
  financialStrategy?: FinancialStrategyState | null;
  status: FinancesProps["status"];
}) {
  const position = financialStrategy?.viewModel?.position;
  const fallbackCash = dashboard?.club.budget ?? null;
  return (
    <Section title="Financial Position" className="atlas-finances-position">
      {position ? (
        <>
          <div className="atlas-finances-status-row">
            <StatusBadge status={position.statusLabel} />
            <span>{position.confidence} confidence</span>
          </div>
          <MetricGrid
            metrics={[
              ["Cash", position.cash, position.provenance.cash],
              [
                "Squad Asset Value",
                position.squadValue,
                `${position.provenance.squadValue} · ${position.squadValueCoverage}`
              ],
              ["Known Weekly Payroll", position.payroll, "Derived from known wages"],
              ["Known Payroll Coverage", position.payrollCoverage, "Derived safety metric"],
              ["Known Capital", position.knownCapital, "Observed cash + estimated sporting assets"],
              ["Liquidity", position.liquidity, "Cash share of known capital"]
            ]}
          />
          <PositionSignals reasons={position.reasons} warnings={position.warnings} />
        </>
      ) : (
        <PanelMessage>
          {status === "loading"
            ? "Loading financial position..."
            : fallbackCash !== null
              ? `Cash · ${formatMoney({ amount: fallbackCash, currency: dashboard?.club.currency ?? null, isComplete: true })} · Observed`
              : "Financial position data is not available yet."}
        </PanelMessage>
      )}
    </Section>
  );
}

function CapitalCapacitySection({
  financialStrategy
}: {
  financialStrategy?: FinancialStrategyState | null;
}) {
  const capacity = financialStrategy?.viewModel?.capacity;
  return (
    <Section title="Capital Capacity">
      {capacity ? (
        <>
          <MetricGrid
            metrics={[
              ["Cash", financialStrategy?.viewModel?.position.cash ?? "—", "Observed"],
              ["Safety Reserve", capacity.reserve, `${capacity.reserveWeeks} · ATLAS policy`],
              ["Spendable Cash", capacity.spendableCash, "Cash after protected reserve"],
              ["Conservative Capacity", capacity.conservative, "Prudent commitment"],
              ["Maximum Recommended", capacity.maximumRecommended, "Upper recommended commitment"]
            ]}
          />
          <p className="atlas-finances-panel__note">
            Safety reserve is a strategic ATLAS policy, not a game obligation.
          </p>
        </>
      ) : (
        <PanelMessage>Capital capacity is not available yet.</PanelMessage>
      )}
    </Section>
  );
}

function InvestmentSimulator({ financialStrategy }: { financialStrategy?: FinancialStrategyState | null }) {
  const [amount, setAmount] = useState("");
  const safety = financialStrategy?.investmentSafetyView;
  const handleSimulate = () => {
    const numericAmount = Number(amount);
    if (Number.isFinite(numericAmount) && numericAmount >= 0 && financialStrategy)
      void financialStrategy.simulateInvestment(numericAmount);
  };
  return (
    <Section title="Investment Simulator">
      <div className="atlas-finances-simulator">
        <label htmlFor="financial-commitment">Simulate commitment</label>
        <input
          id="financial-commitment"
          inputMode="decimal"
          min="0"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Amount"
          type="number"
          value={amount}
        />
        <button
          type="button"
          onClick={handleSimulate}
          disabled={Boolean(financialStrategy?.isSimulating) || amount === ""}
        >
          {financialStrategy?.isSimulating ? "Simulating..." : "Simulate"}
        </button>
      </div>
      {safety ? (
        <MetricGrid
          metrics={[
            ["Post-investment Cash", safety.cash, "Derived simulation"],
            ["Payroll Coverage", safety.coverage, "Known payroll only"],
            ["Financial Status", safety.status, "Derived simulation"],
            ["Investment Safety", safety.safety, "Derived simulation"]
          ]}
        />
      ) : (
        <p className="atlas-finances-panel__note">
          Simulation is analytical only and never changes the club budget.
        </p>
      )}
    </Section>
  );
}

function StrategicRecommendationsSection({
  financialStrategy,
  onSelectPlayer
}: {
  financialStrategy?: FinancialStrategyState | null;
  onSelectPlayer?: (playerId: string) => void;
}) {
  const recommendations = financialStrategy?.viewModel?.recommendations ?? [];
  return (
    <Section title="Strategic Recommendations" className="atlas-finances-recommendations">
      {financialStrategy?.status === "ready" && recommendations.length === 0 ? (
        <PanelMessage>
          Financial strategy is currently stable. No high-priority action required.
        </PanelMessage>
      ) : null}
      <div className="atlas-finances-recommendation-list">
        {recommendations.map((recommendation) => (
          <article
            className={`atlas-finances-recommendation is-${recommendation.priority.toLowerCase()}`}
            key={recommendation.id}
            >
            <div className="atlas-finances-recommendation__header">
              <div>
                <span className="atlas-finances-eyebrow">
                  {recommendation.priority} · {recommendation.horizon}
                </span>
                <h3>{recommendation.title}</h3>
              </div>
              <StatusBadge status={recommendation.confidence} />
            </div>
            <p>{recommendation.description}</p>
            {recommendation.playerIds.length > 0 ? (
              <div className="atlas-finances-player-links">
                {recommendation.playerIds.map((playerId, index) => (
                  <PlayerLink
                    key={playerId}
                    playerId={String(playerId)}
                    onSelectPlayer={onSelectPlayer}
                  >
                    {recommendation.playerNames[index] ?? `Player ${playerId}`}
                  </PlayerLink>
                ))}
              </div>
            ) : null}
            <ul className="atlas-finances-reason-list">
              {recommendation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {recommendation.financialImpact.length > 0 ? (
              <div className="atlas-finances-impact">
                {recommendation.financialImpact.join(" · ")}
              </div>
            ) : null}
            {recommendation.risks.length > 0 ? (
              <details className="atlas-finances-recommendation__details">
                <summary>Risks</summary>
                <ul className="atlas-finances-risk-list">
                  {recommendation.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}

function FundingPlanSection({ financialStrategy }: { financialStrategy?: FinancialStrategyState | null }) {
  const funding = financialStrategy?.viewModel?.funding;
  return (
    <Section title="Strategic Funding">
      {!funding || funding.needs.length === 0 ? (
        <PanelMessage>
          {financialStrategy?.status === "ready"
            ? "Strategic funding needs are not available from current Squad Planning data."
            : "Funding plan is not available yet."}
        </PanelMessage>
      ) : (
        <>
          <div className="atlas-finances-table-wrap">
            <table className="atlas-finances-table">
              <thead>
                <tr>
                  <th>Need</th>
                  <th>Priority</th>
                  <th>Horizon</th>
                  <th>Expected</th>
                  <th>Allocated</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {funding.needs.map((need) => (
                  <tr key={need.id}>
                    <th scope="row">{need.profile}</th>
                    <td>{need.priority}</td>
                    <td>{need.horizon}</td>
                    <td>{need.expectedCost}</td>
                    <td>{need.allocated}</td>
                    <td>{need.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {funding.totalGap !== "—" ? (
            <p className="atlas-finances-gap">Total estimated funding gap: {funding.totalGap}</p>
          ) : null}
        </>
      )}
    </Section>
  );
}

function SquadAssetsSection({
  financialStrategy,
  onSelectPlayer
}: {
  financialStrategy?: FinancialStrategyState | null;
  onSelectPlayer?: (playerId: string) => void;
}) {
  const assets = financialStrategy?.viewModel?.assets;
  const development = financialStrategy?.viewModel?.developmentCapital;
  if (!assets)
    return (
      <Section title="Squad Assets">
        <PanelMessage>Squad asset valuation is not available yet.</PanelMessage>
      </Section>
    );
  return (
    <Section title="Squad Assets">
      <MetricGrid
        metrics={[
          ["Estimated Squad Value", assets.estimatedValue, `Estimated · ${assets.coverage}`],
          ["Current Cash", financialStrategy?.viewModel?.position.cash ?? "—", "Observed"],
          ["Known Capital", assets.knownCapital, "Observed cash + estimated sporting assets"],
          [
            "Top 3 Concentration",
            assets.concentration,
            assets.concentrationWarning ? "High asset concentration" : "Derived market metric"
          ],
          ["Potential Liquidity", assets.potentialLiquidity, "Not cash until a transfer occurs"]
        ]}
      />
      <DevelopmentUpside development={development} />
      {assets.distribution.length > 0 ? (
        <CompactList
          title="Asset distribution"
          items={assets.distribution.map((item) => `${item.role} · ${item.value}`)}
        />
      ) : null}
      {assets.monetizable.length > 0 ? (
        <AssetList
          title="Potential Liquidity"
          assets={assets.monetizable}
          onSelectPlayer={onSelectPlayer}
        />
      ) : null}
      {assets.protectedAssets.length > 0 ? (
        <div className="atlas-finances-subsection">
          <h3>Protected Strategic Assets</h3>
          <ul className="atlas-finances-asset-list">
            {assets.protectedAssets.map((asset) => (
              <li key={asset.playerId}>
                <PlayerLink playerId={String(asset.playerId)} onSelectPlayer={onSelectPlayer}>
                  {asset.name}
                </PlayerLink>
                <strong>
                  {asset.value}
                  {asset.isTheoretical ? (
                    <span title="Tasación teórica" className="atlas-finances-theoretical-icon" style={{ cursor: "help", marginLeft: "6px", opacity: 0.6, display: "inline-flex", verticalAlign: "text-bottom" }}>
                      <Info size={16} />
                    </span>
                  ) : null}
                </strong>
                <small>{asset.reasons.join(" · ")}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

interface DevelopmentUpsideProps {
  development: NonNullable<FinancialStrategyState["viewModel"]>["developmentCapital"] | undefined;
}

function DevelopmentUpside({ development }: DevelopmentUpsideProps) {
  if (!development) return null;

  return (
    <aside className="atlas-finances-development-upside" aria-label="Development upside">
      <div>
        <span>Development upside</span>
        <small>
          {development.coveredPlayers} · {development.confidence} confidence
        </small>
      </div>
      <strong>{development.valueCreation}</strong>
      <p>
        Projected covered value: {development.currentValue} → {development.projectedValue}
      </p>
    </aside>
  );
}

function AssetList({
  title,
  assets,
  onSelectPlayer
}: {
  title: string;
  assets: NonNullable<FinancialStrategyState["viewModel"]>["assets"]["monetizable"];
  onSelectPlayer?: (playerId: string) => void;
}) {
  return (
    <div className="atlas-finances-subsection">
      <h3>{title}</h3>
      <ul className="atlas-finances-asset-list">
        {assets.map((asset) => (
          <li key={asset.playerId}>
            <PlayerLink playerId={String(asset.playerId)} onSelectPlayer={onSelectPlayer}>
              {asset.name}
            </PlayerLink>
            <strong>
              {asset.value}
              {asset.isTheoretical ? (
                <span title="Tasación teórica" className="atlas-finances-theoretical-icon" style={{ cursor: "help", marginLeft: "6px", opacity: 0.6, display: "inline-flex", verticalAlign: "text-bottom" }}>
                  <Info size={16} />
                </span>
              ) : null}
            </strong>
            <small>
              {asset.role} · Liquidity potential: {asset.liquidity}
              {asset.recommended ? " · Recommended monetization" : ""}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConflictsSection({
  financialStrategy,
  onSelectPlayer
}: {
  financialStrategy?: FinancialStrategyState | null;
  onSelectPlayer?: (playerId: string) => void;
}) {
  const conflicts = financialStrategy?.viewModel?.conflicts ?? [];
  if (conflicts.length === 0) return null;
  return (
    <Section title="Strategic Conflicts">
      <ul className="atlas-finances-conflict-list">
        {conflicts.map((conflict, index) => (
          <li key={`${conflict.playerId ?? "club"}-${index}`}>
            <strong>
              {conflict.playerName && conflict.playerId !== null ? (
                <PlayerLink playerId={String(conflict.playerId)} onSelectPlayer={onSelectPlayer}>
                  {conflict.playerName}
                </PlayerLink>
              ) : (
                "Club strategy"
              )}
            </strong>
            <span>{conflict.description}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function PositionSignals({ reasons, warnings }: { reasons: string[]; warnings: string[] }) {
  if (reasons.length === 0 && warnings.length === 0) return null;
  return (
    <div className="atlas-finances-signals">
      {reasons.length > 0 ? (
        <div>
          <h3>Why</h3>
          <ul>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div>
          <h3>Watch</h3>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CompactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="atlas-finances-subsection">
      <h3>{title}</h3>
      <ul className="atlas-finances-compact-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, string, string]> }) {
  return (
    <div className="atlas-finances-metric-grid">
      {metrics.map(([label, value, meta]) => (
        <div className="atlas-finances-metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{meta}</small>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
  className = ""
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const id = `${title.toLowerCase().replaceAll(" ", "-")}-title`;
  return (
    <section className={`atlas-finances-panel ${className}`} aria-labelledby={id}>
      <h2 className="atlas-finances-panel__title atlas-section-title" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function PanelMessage({ children, tone }: { children: string; tone?: "error" }) {
  return <p className={`atlas-finances-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}


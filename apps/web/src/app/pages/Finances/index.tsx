import { formatMoney } from "@atlas/web/app/formatters";
import {
  createFinancesViewModel,
  hasFinancialData,
  type FinanceAttentionItem,
  type FinanceLineItem,
  type FinancesViewModel
} from "../../view-models/finances-view-model";
import type { DashboardStatus } from "@atlas/web/app/types";
import type { FinancesProps } from "./types";
import { AttentionIcon } from "../../components/AttentionIcon";
import { PlayerLink } from "../../components/PlayerLink";

export function Finances({ dashboard, onSelectPlayer, squadPlanning, status }: FinancesProps) {
  const viewModel = createFinancesViewModel({ dashboard, squadPlanning });

  return (
    <div className="atlas-finances">
      <header className="atlas-finances__header">
        <h1>Finances</h1>
      </header>

      <FinanceAttention items={viewModel.diagnostics} status={status} />
      <SquadAssetValue onSelectPlayer={onSelectPlayer} status={status} viewModel={viewModel} />
      <FinancialOverview viewModel={viewModel} status={status} />

      <div className="atlas-finances__breakdown-grid">
        <FinanceBreakdown
          items={viewModel.income}
          title="Income"
          total={viewModel.overview.income}
          status={status}
        />
        <FinanceBreakdown
          items={viewModel.expenses}
          title="Expenses"
          total={viewModel.overview.expenses}
          status={status}
        />
      </div>
    </div>
  );
}

interface SquadAssetValueProps {
  onSelectPlayer: (playerId: string) => void;
  status: DashboardStatus;
  viewModel: FinancesViewModel;
}

function SquadAssetValue({ onSelectPlayer, status, viewModel }: SquadAssetValueProps) {
  const assets = viewModel.squadAssets;
  return (
    <section
      className="atlas-finances-panel atlas-squad-asset-value"
      aria-labelledby="squad-asset-value-title"
    >
      <div className="atlas-finances-panel__heading-row">
        <PanelTitle id="squad-asset-value-title" title="Squad Asset Value" />
        <span>
          {assets.coverage.valued}/{assets.coverage.total} players valued
        </span>
      </div>
      {status === "loading" ? <PanelMessage>Loading squad assets...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Squad asset values are temporarily unavailable.</PanelMessage>
      ) : null}
      {status === "idle" ? <PanelMessage>No squad asset data available.</PanelMessage> : null}
      {status === "ready" && assets.coverage.valued === 0 ? (
        <PanelMessage>Insufficient data to estimate squad asset value.</PanelMessage>
      ) : null}
      {status === "ready" && assets.coverage.valued > 0 ? (
        <>
          <div className="atlas-finances-asset-metrics">
            <FinanceAssetMetric label="Current squad value" value={assets.currentTotal.label} />
            <FinanceAssetMetric
              label="Projected at development targets"
              value={assets.projectedTotal.label}
            />
            <FinanceAssetMetric
              label="Potential value creation"
              value={assets.potentialValueCreation.label}
            />
            <FinanceAssetMetric
              label="Cash"
              value={viewModel.overview.cash ? formatMoney(viewModel.overview.cash) : "—"}
            />
          </div>
          <p className="atlas-finances-panel__note">
            Cash and squad assets are separate concepts; squad value is not immediate liquidity.
          </p>
          <div className="atlas-finances-asset-columns">
            <div>
              <h3>By squad role</h3>
              <ul className="atlas-finances-breakdown-list">
                {assets.breakdown.map((item) => (
                  <li className="atlas-finances-breakdown-row" key={item.role}>
                    <span>{item.role}</span>
                    <strong>{item.value.label}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Top player assets</h3>
              <ol className="atlas-finances-top-assets">
                {assets.topAssets.map((asset) => (
                  <li key={asset.playerId}>
                    <PlayerLink playerId={asset.playerId} onSelectPlayer={onSelectPlayer}>
                      {asset.name}
                    </PlayerLink>
                    <strong>{asset.value.label}</strong>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function FinanceAssetMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="atlas-finances-asset-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface FinanceAttentionProps {
  items: FinanceAttentionItem[];
  status: DashboardStatus;
}

function FinanceAttention({ items, status }: FinanceAttentionProps) {
  return (
    <section
      className="atlas-finances-panel atlas-finances-panel--attention"
      aria-labelledby="finance-attention-title"
    >
      <PanelTitle id="finance-attention-title" title="Finance Attention" />
      {status === "loading" ? <PanelMessage>Loading finances...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Unable to load financial data.</PanelMessage>
      ) : null}
      {status === "idle" ? <PanelMessage>No financial data available.</PanelMessage> : null}
      {status === "ready" && items.length === 0 ? (
        <PanelMessage>No financial diagnostics available.</PanelMessage>
      ) : null}
      {status === "ready" && items.length > 0 ? (
        <ul className="atlas-finances-attention-list">
          {items.map((item) => (
            <li className={`atlas-finances-attention-item is-${item.severity}`} key={item.id}>
              <AttentionIcon severity={item.severity} />
              <span>{item.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

interface FinancialOverviewProps {
  status: DashboardStatus;
  viewModel: FinancesViewModel;
}

function FinancialOverview({ status, viewModel }: FinancialOverviewProps) {
  const metrics = [
    ["Cash", viewModel.overview.cash],
    ["Income", viewModel.overview.income],
    ["Expenses", viewModel.overview.expenses],
    ["Balance", viewModel.overview.balance]
  ] as const;

  return (
    <section className="atlas-finances-panel" aria-labelledby="financial-overview-title">
      <div className="atlas-finances-panel__heading-row">
        <PanelTitle id="financial-overview-title" title="Financial Overview" />
        {viewModel.period ? (
          <span className="atlas-finances-period">{viewModel.period}</span>
        ) : null}
      </div>
      {status === "loading" ? <PanelMessage>Loading finances...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Unable to load financial data.</PanelMessage>
      ) : null}
      {status === "idle" ? <PanelMessage>No financial data available.</PanelMessage> : null}
      {status === "ready" ? (
        <>
          <dl className="atlas-finances-overview-list">
            {metrics.map(([label, amount]) => (
              <div className="atlas-finances-overview-row" key={label}>
                <dt>{label}</dt>
                <dd>{formatMoney(amount)}</dd>
              </div>
            ))}
          </dl>
          {!hasFinancialData(viewModel) ? (
            <p className="atlas-finances-panel__note">No financial data available.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

interface FinanceBreakdownProps {
  items: FinanceLineItem[];
  title: string;
  total: FinanceLineItem["amount"] | null;
  status: DashboardStatus;
}

function FinanceBreakdown({ items, title, total, status }: FinanceBreakdownProps) {
  return (
    <section className="atlas-finances-panel" aria-labelledby={`${title.toLowerCase()}-title`}>
      <PanelTitle id={`${title.toLowerCase()}-title`} title={title} />
      {status === "loading" ? <PanelMessage>Loading finances...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Unable to load financial data.</PanelMessage>
      ) : null}
      {status === "idle" ? <PanelMessage>No financial data available.</PanelMessage> : null}
      {status === "ready" && items.length === 0 ? (
        <PanelMessage>No financial data available.</PanelMessage>
      ) : null}
      {status === "ready" && items.length > 0 ? (
        <>
          <ul className="atlas-finances-breakdown-list">
            {items.map((item) => (
              <li className="atlas-finances-breakdown-row" key={item.key}>
                <span>{item.label}</span>
                <strong>{formatMoney(item.amount)}</strong>
              </li>
            ))}
          </ul>
          {total ? (
            <div className="atlas-finances-breakdown-total">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function PanelTitle({ id, title }: { id: string; title: string }) {
  return (
    <h2 className="atlas-finances-panel__title atlas-section-title" id={id}>
      {title}
    </h2>
  );
}

function PanelMessage({ children, tone }: { children: string; tone?: "error" }) {
  return <p className={`atlas-finances-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

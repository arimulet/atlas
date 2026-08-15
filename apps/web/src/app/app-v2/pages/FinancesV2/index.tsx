import { formatV2Money } from "@atlas/web/app/app-v2/formatters";
import {
  createFinancesViewModel,
  hasFinancialData,
  type FinanceAttentionItem,
  type FinanceLineItem,
  type FinancesViewModel
} from "../../view-models/finances-view-model";
import type { DashboardStatus } from "@atlas/web/app/types";
import type { FinancesV2Props } from "./types";
import { V2AttentionIcon } from "../../components/V2AttentionIcon";

export function FinancesV2({ status }: FinancesV2Props) {
  const viewModel = createFinancesViewModel();

  return (
    <div className="v2-finances">
      <header className="v2-finances__header">
        <h1>Finances</h1>
      </header>

      <FinanceAttention items={viewModel.diagnostics} status={status} />
      <FinancialOverview viewModel={viewModel} status={status} />

      <div className="v2-finances__breakdown-grid">
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

interface FinanceAttentionProps {
  items: FinanceAttentionItem[];
  status: DashboardStatus;
}

function FinanceAttention({ items, status }: FinanceAttentionProps) {
  return (
    <section
      className="v2-finances-panel v2-finances-panel--attention"
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
        <ul className="v2-finances-attention-list">
          {items.map((item) => (
            <li className={`v2-finances-attention-item is-${item.severity}`} key={item.id}>
              <V2AttentionIcon severity={item.severity} />
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
    <section className="v2-finances-panel" aria-labelledby="financial-overview-title">
      <div className="v2-finances-panel__heading-row">
        <PanelTitle id="financial-overview-title" title="Financial Overview" />
        {viewModel.period ? <span className="v2-finances-period">{viewModel.period}</span> : null}
      </div>
      {status === "loading" ? <PanelMessage>Loading finances...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Unable to load financial data.</PanelMessage>
      ) : null}
      {status === "idle" ? <PanelMessage>No financial data available.</PanelMessage> : null}
      {status === "ready" ? (
        <>
          <dl className="v2-finances-overview-list">
            {metrics.map(([label, amount]) => (
              <div className="v2-finances-overview-row" key={label}>
                <dt>{label}</dt>
                <dd>{formatV2Money(amount)}</dd>
              </div>
            ))}
          </dl>
          {!hasFinancialData(viewModel) ? (
            <p className="v2-finances-panel__note">No financial data available.</p>
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
    <section className="v2-finances-panel" aria-labelledby={`${title.toLowerCase()}-title`}>
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
          <ul className="v2-finances-breakdown-list">
            {items.map((item) => (
              <li className="v2-finances-breakdown-row" key={item.key}>
                <span>{item.label}</span>
                <strong>{formatV2Money(item.amount)}</strong>
              </li>
            ))}
          </ul>
          {total ? (
            <div className="v2-finances-breakdown-total">
              <span>Total</span>
              <strong>{formatV2Money(total)}</strong>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function PanelTitle({ id, title }: { id: string; title: string }) {
  return (
    <h2 className="v2-finances-panel__title v2-section-title" id={id}>
      {title}
    </h2>
  );
}

function PanelMessage({ children, tone }: { children: string; tone?: "error" }) {
  return <p className={`v2-finances-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

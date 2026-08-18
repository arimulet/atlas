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

export function Finances({ status }: FinancesProps) {
  const viewModel = createFinancesViewModel();

  return (
    <div className="atlas-finances">
      <header className="atlas-finances__header">
        <h1>Finances</h1>
      </header>

      <FinanceAttention items={viewModel.diagnostics} status={status} />
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
        {viewModel.period ? <span className="atlas-finances-period">{viewModel.period}</span> : null}
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

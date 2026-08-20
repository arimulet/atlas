import type { MoneyTotal, Severity } from "@atlas/web/app/types";
import type { ClubDashboard, SquadPlanningBundle } from "@atlas/web/app/types";
import {
  createSquadMarketValueSummary,
  type SquadMarketValueSummaryViewModel
} from "./market-value-view-model";

export interface FinanceAttentionItem {
  id: string;
  message: string;
  severity: Severity;
}

export interface FinanceLineItem {
  key: string;
  label: string;
  amount: MoneyTotal;
}

export interface FinancesViewModel {
  period: string | null;
  overview: {
    cash: MoneyTotal | null;
    income: MoneyTotal | null;
    expenses: MoneyTotal | null;
    balance: MoneyTotal | null;
  };
  income: FinanceLineItem[];
  expenses: FinanceLineItem[];
  diagnostics: FinanceAttentionItem[];
  squadAssets: SquadMarketValueSummaryViewModel;
}

export function createFinancesViewModel(
  input: {
    dashboard?: ClubDashboard | null;
    squadPlanning?: SquadPlanningBundle | null;
  } = {}
): FinancesViewModel {
  const currency = input.dashboard?.club.currency ?? null;
  return {
    period: null,
    overview: {
      cash:
        input.dashboard?.club.budget === null || input.dashboard?.club.budget === undefined
          ? null
          : { amount: input.dashboard.club.budget, currency, isComplete: true },
      income: null,
      expenses: null,
      balance: null
    },
    income: [],
    expenses: [],
    diagnostics: [],
    squadAssets: createSquadMarketValueSummary(
      input.squadPlanning?.assessment.depthPlayers ?? [],
      currency
    )
  };
}

export function hasFinancialData(viewModel: FinancesViewModel): boolean {
  return (
    Object.values(viewModel.overview).some((value) => value !== null) ||
    viewModel.income.length > 0 ||
    viewModel.expenses.length > 0 ||
    viewModel.squadAssets.coverage.valued > 0
  );
}

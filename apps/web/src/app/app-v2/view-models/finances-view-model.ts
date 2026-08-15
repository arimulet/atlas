import type { MoneyTotal, Severity } from "@atlas/web/app/types";

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
}

export function createFinancesViewModel(): FinancesViewModel {
  return {
    period: null,
    overview: {
      cash: null,
      income: null,
      expenses: null,
      balance: null
    },
    income: [],
    expenses: [],
    diagnostics: []
  };
}

export function hasFinancialData(viewModel: FinancesViewModel): boolean {
  return (
    Object.values(viewModel.overview).some((value) => value !== null) ||
    viewModel.income.length > 0 ||
    viewModel.expenses.length > 0
  );
}

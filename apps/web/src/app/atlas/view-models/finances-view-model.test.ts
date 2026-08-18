import { describe, expect, it } from "vitest";
import { createFinancesViewModel, hasFinancialData } from "./finances-view-model";

describe("finances view model", () => {
  it("does not invent financial values or categories when the current model has no club finance data", () => {
    const viewModel = createFinancesViewModel();

    expect(viewModel.overview).toEqual({
      cash: null,
      income: null,
      expenses: null,
      balance: null
    });
    expect(viewModel.income).toEqual([]);
    expect(viewModel.expenses).toEqual([]);
    expect(viewModel.diagnostics).toEqual([]);
    expect(hasFinancialData(viewModel)).toBe(false);
  });
});

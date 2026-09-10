import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchFinancialStrategy,
  fetchInvestmentSafety,
  type FinancialStrategyData
} from "../../api";
import type { InvestmentSafetyAssessment } from "@atlas/domain";
import type { SquadPlanningBundle } from "../../types";
import {
  createFinancialStrategyViewModel,
  createInvestmentSafetyViewModel,
  type FinancialStrategyViewModel
} from "./financial-strategy-view-model";

export interface UseFinancialStrategyInput {
  clubId: string | null;
  currency: string | null;
  squadPlanning: SquadPlanningBundle | null;
}

export interface FinancialStrategyState {
  data: FinancialStrategyData | null;
  viewModel: FinancialStrategyViewModel | null;
  investmentSafety: InvestmentSafetyAssessment | null;
  investmentSafetyView: ReturnType<typeof createInvestmentSafetyViewModel>;
  status: "idle" | "loading" | "ready" | "error";
  isSimulating: boolean;
  error: Error | null;
  simulateInvestment: (amount: number) => Promise<void>;
}

export function useFinancialStrategy({
  clubId,
  currency,
  squadPlanning
}: UseFinancialStrategyInput): FinancialStrategyState {
  const [data, setData] = useState<FinancialStrategyData | null>(null);
  const [status, setStatus] = useState<FinancialStrategyState["status"]>(
    clubId ? "loading" : "idle"
  );
  const [error, setError] = useState<Error | null>(null);
  const [investmentSafety, setInvestmentSafety] = useState<InvestmentSafetyAssessment | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    if (!clubId) {
      setData(null);
      setError(null);
      setStatus("idle");
      return () => {
        isCurrent = false;
      };
    }

    setStatus("loading");
    setError(null);
    void fetchFinancialStrategy(clubId)
      .then((nextData) => {
        if (!isCurrent) return;
        setData(nextData);
        setStatus("ready");
      })
      .catch((nextError: unknown) => {
        if (!isCurrent) return;
        setData(null);
        setStatus("error");
        setError(
          nextError instanceof Error ? nextError : new Error("Financial strategy unavailable.")
        );
      });

    return () => {
      isCurrent = false;
    };
  }, [clubId]);

  const simulateInvestment = useCallback(
    async (amount: number): Promise<void> => {
      if (!clubId || !Number.isFinite(amount) || amount < 0) return;
      setIsSimulating(true);
      try {
        setInvestmentSafety(await fetchInvestmentSafety(clubId, amount));
      } finally {
        setIsSimulating(false);
      }
    },
    [clubId]
  );

  const viewModel = useMemo(
    () => (data ? createFinancialStrategyViewModel(data, currency, squadPlanning) : null),
    [currency, data, squadPlanning]
  );
  const investmentSafetyView = useMemo(
    () => createInvestmentSafetyViewModel(investmentSafety, currency),
    [currency, investmentSafety]
  );

  return {
    data,
    viewModel,
    investmentSafety,
    investmentSafetyView,
    status,
    isSimulating,
    error,
    simulateInvestment
  };
}

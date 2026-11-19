import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAcquisitionSimulation,
  fetchFinancialStrategy,
  fetchInvestmentSafety,
  lookupPlayer,
  type FinancialStrategyData,
  type PlayerLookupResult
} from "@/api";
import type {
  InvestmentSafetyAssessment,
  PlayerAcquisitionSimulationInput,
  PlayerAcquisitionSimulationResult
} from "@atlas/domain";
import type { SquadPlanningBundle } from "@/app/types";
import {
  createAcquisitionSimulationViewModel,
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
  currentGameWeek: number | null;
  data: FinancialStrategyData | null;
  viewModel: FinancialStrategyViewModel | null;
  investmentSafety: InvestmentSafetyAssessment | null;
  investmentSafetyView: ReturnType<typeof createInvestmentSafetyViewModel>;
  acquisitionResult: ReturnType<typeof createAcquisitionSimulationViewModel>;
  isSimulatingAcquisition: boolean;
  status: "idle" | "loading" | "ready" | "error";
  isSimulating: boolean;
  error: Error | null;
  simulateInvestment: (amount: number) => Promise<void>;
  simulateAcquisition: (
    input: PlayerAcquisitionSimulationInput
  ) => Promise<PlayerAcquisitionSimulationResult>;
  recalculateAcquisitionTargets: (
    targetLevels: NonNullable<PlayerAcquisitionSimulationInput["targetLevels"]>,
    targetPosition: NonNullable<PlayerAcquisitionSimulationInput["targetPosition"]>
  ) => Promise<PlayerAcquisitionSimulationResult>;
  lookupPlayer: (playerId: number) => Promise<PlayerLookupResult>;
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
  const [acquisitionResultRaw, setAcquisitionResultRaw] =
    useState<PlayerAcquisitionSimulationResult | null>(null);
  const [isSimulatingAcquisition, setIsSimulatingAcquisition] = useState(false);
  const lastAcquisitionInput = useRef<PlayerAcquisitionSimulationInput | null>(null);

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

  const simulateAcquisition = useCallback(
    async (input: PlayerAcquisitionSimulationInput): Promise<PlayerAcquisitionSimulationResult> => {
      setIsSimulatingAcquisition(true);
      try {
        const result = await fetchAcquisitionSimulation(input);
        lastAcquisitionInput.current = input;
        setAcquisitionResultRaw(result);
        return result;
      } finally {
        setIsSimulatingAcquisition(false);
      }
    },
    []
  );

  const recalculateAcquisitionTargets = useCallback(
    (targetLevels: NonNullable<PlayerAcquisitionSimulationInput["targetLevels"]>, targetPosition: NonNullable<PlayerAcquisitionSimulationInput["targetPosition"]>) => {
      if (!lastAcquisitionInput.current) {
        return Promise.reject(new Error("Run a simulation before changing targets."));
      }
      return simulateAcquisition({ ...lastAcquisitionInput.current, targetLevels, targetPosition });
    },
    [simulateAcquisition]
  );

  const handleLookupPlayer = useCallback(async (playerId: number): Promise<PlayerLookupResult> => {
    return lookupPlayer(playerId);
  }, []);

  const viewModel = useMemo(
    () => (data ? createFinancialStrategyViewModel(data, currency, squadPlanning) : null),
    [currency, data, squadPlanning]
  );
  const investmentSafetyView = useMemo(
    () => createInvestmentSafetyViewModel(investmentSafety, currency),
    [currency, investmentSafety]
  );
  const acquisitionResult = useMemo(
    () => createAcquisitionSimulationViewModel(acquisitionResultRaw, currency),
    [acquisitionResultRaw, currency]
  );

  return {
    currentGameWeek: squadPlanning?.assessment.currentGameWeek ?? null,
    data,
    viewModel,
    investmentSafety,
    investmentSafetyView,
    acquisitionResult,
    isSimulatingAcquisition,
    status,
    isSimulating,
    error,
    simulateInvestment,
    simulateAcquisition,
    recalculateAcquisitionTargets,
    lookupPlayer: handleLookupPlayer
  };
}

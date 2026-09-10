import { useEffect, useState } from "react";

import { fetchWeeklyTrainingIntelligence } from "../../api";
import type { WeeklyTrainingIntelligence } from "../../types";

export interface WeeklyTrainingIntelligenceState {
  data: WeeklyTrainingIntelligence | null;
  isLoading: boolean;
  error: Error | null;
}

export function useWeeklyTrainingIntelligence(
  clubId: string | null
): WeeklyTrainingIntelligenceState {
  const [state, setState] = useState<WeeklyTrainingIntelligenceState>({
    data: null,
    isLoading: Boolean(clubId),
    error: null
  });

  useEffect(() => {
    if (!clubId) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    const activeClubId = clubId;
    let isCurrent = true;
    setState({ data: null, isLoading: true, error: null });

    async function loadIntelligence(): Promise<void> {
      try {
        const data = await fetchWeeklyTrainingIntelligence(activeClubId);
        if (isCurrent) {
          setState({ data, isLoading: false, error: null });
        }
      } catch (error: unknown) {
        if (!isCurrent) {
          return;
        }

        setState({
          data: null,
          isLoading: false,
          error: error instanceof Error ? error : new Error("Unable to load training intelligence.")
        });
      }
    }

    void loadIntelligence();

    return () => {
      isCurrent = false;
    };
  }, [clubId]);

  return state;
}

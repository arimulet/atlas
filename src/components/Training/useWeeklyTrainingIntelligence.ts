import { useEffect, useState } from "react";

import { fetchWeeklyTrainingIntelligence } from "@/api";
import type { WeeklyTrainingIntelligence } from "@/app/types";

export interface WeeklyTrainingIntelligenceState {
  data: WeeklyTrainingIntelligence | null;
  isLoading: boolean;
  error: Error | null;
}

const intelligenceCache = new Map<string, { data: WeeklyTrainingIntelligence; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute in-memory cache

export function useWeeklyTrainingIntelligence(
  clubId: string | null
): WeeklyTrainingIntelligenceState {
  const cached = clubId ? intelligenceCache.get(clubId) : null;
  const isCacheValid = cached && Date.now() - cached.timestamp < CACHE_TTL_MS;

  const [state, setState] = useState<WeeklyTrainingIntelligenceState>({
    data: isCacheValid ? cached.data : null,
    isLoading: Boolean(clubId) && !isCacheValid,
    error: null
  });

  useEffect(() => {
    if (!clubId) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    const cachedEntry = intelligenceCache.get(clubId);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
      setState({ data: cachedEntry.data, isLoading: false, error: null });
      return;
    }

    const activeClubId = clubId;
    let isCurrent = true;
    setState({ data: null, isLoading: true, error: null });

    // Slight defer to prioritize initial critical UI render
    const timer = setTimeout(() => {
      async function loadIntelligence(): Promise<void> {
        try {
          const data = await fetchWeeklyTrainingIntelligence(activeClubId);
          intelligenceCache.set(activeClubId, { data, timestamp: Date.now() });
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
    }, 50);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [clubId]);

  return state;
}

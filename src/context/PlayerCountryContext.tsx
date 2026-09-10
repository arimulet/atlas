"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

// In-memory module-level cache to ensure instant country lookup across all views
const playerCountryCache = new Map<string, string>();

export function registerPlayerCountry(
  playerId: string | number | null | undefined,
  countryName: string | null | undefined
): void {
  if (!playerId || !countryName) return;
  playerCountryCache.set(String(playerId), countryName);
}

export function registerPlayerCountries(
  players: readonly {
    playerId?: string | number | null;
    id?: string | number | null;
    countryName?: string | null;
  }[]
): void {
  for (const player of players) {
    const id = player.playerId ?? player.id;
    if (id && player.countryName) {
      playerCountryCache.set(String(id), player.countryName);
    }
  }
}

export function getCachedPlayerCountry(
  playerId: string | number | null | undefined
): string | null {
  if (!playerId) return null;
  return playerCountryCache.get(String(playerId)) ?? null;
}

interface PlayerCountryContextType {
  getCountry: (playerId: string | number | null | undefined) => string | null;
  registerPlayers: (
    players: readonly {
      playerId?: string | number | null;
      id?: string | number | null;
      countryName?: string | null;
    }[]
  ) => void;
}

const PlayerCountryContext = createContext<PlayerCountryContextType>({
  getCountry: getCachedPlayerCountry,
  registerPlayers: registerPlayerCountries
});

export function PlayerCountryProvider({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);

  const registerPlayers = useCallback(
    (
      players: readonly {
        playerId?: string | number | null;
        id?: string | number | null;
        countryName?: string | null;
      }[]
    ) => {
      let added = false;
      for (const player of players) {
        const id = player.playerId ?? player.id;
        if (id && player.countryName && !playerCountryCache.has(String(id))) {
          playerCountryCache.set(String(id), player.countryName);
          added = true;
        }
      }
      if (added) {
        setTick((t) => t + 1);
      }
    },
    []
  );

  const getCountry = useCallback((playerId: string | number | null | undefined) => {
    return getCachedPlayerCountry(playerId);
  }, []);

  const value = useMemo(
    () => ({
      getCountry,
      registerPlayers
    }),
    [getCountry, registerPlayers]
  );

  return (
    <PlayerCountryContext.Provider value={value}>
      {children}
    </PlayerCountryContext.Provider>
  );
}

export function usePlayerCountry(
  playerId: string | number | null | undefined
): string | null {
  const context = useContext(PlayerCountryContext);
  return context ? context.getCountry(playerId) : getCachedPlayerCountry(playerId);
}

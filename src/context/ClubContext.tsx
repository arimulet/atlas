"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { fetchActiveClub, type ActiveClubInfo } from "@/api";
import { useAuth } from "./AuthContext";

export interface ClubContextType {
  club: ActiveClubInfo | null;
  loading: boolean;
  refreshClub: () => Promise<void>;
  hydrateClub: (initialClub: ActiveClubInfo | null) => void;
}

const ClubContext = createContext<ClubContextType>({
  club: null,
  loading: false,
  refreshClub: async () => {},
  hydrateClub: () => {}
});

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [club, setClub] = useState<ActiveClubInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const hasHydratedRef = useRef<boolean>(false);

  const hydrateClub = useCallback((ssrClub: ActiveClubInfo | null) => {
    setClub(ssrClub);
    hasHydratedRef.current = true;
  }, []);

  const refreshClub = useCallback(async () => {
    if (!user) {
      setClub(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const activeClub = await fetchActiveClub();
      setClub(activeClub);
    } catch {
      setClub(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setClub(null);
      setLoading(false);
      hasHydratedRef.current = false;
      return;
    }

    // Skip redundant CSR fetch if club was already hydrated from SSR
    if (hasHydratedRef.current) {
      hasHydratedRef.current = false;
      return;
    }

    void refreshClub();
  }, [user, authLoading, refreshClub]);

  const value = useMemo(
    () => ({
      club,
      loading,
      refreshClub,
      hydrateClub
    }),
    [club, loading, refreshClub, hydrateClub]
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub(): ClubContextType {
  return useContext(ClubContext);
}

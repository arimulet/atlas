"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { fetchActiveClub, type ActiveClubInfo } from "@/api";
import { useAuth } from "./AuthContext";

export interface ClubContextType {
  club: ActiveClubInfo | null;
  loading: boolean;
  refreshClub: () => Promise<void>;
}

const ClubContext = createContext<ClubContextType>({
  club: null,
  loading: false,
  refreshClub: async () => {}
});

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [club, setClub] = useState<ActiveClubInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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
      return;
    }

    void refreshClub();
  }, [user, authLoading, refreshClub]);

  const value = useMemo(
    () => ({
      club,
      loading,
      refreshClub
    }),
    [club, loading, refreshClub]
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub(): ClubContextType {
  return useContext(ClubContext);
}

import { useCallback, useEffect, useState } from "react";

export type V2MainViewId =
  | "dashboard"
  | "squad"
  | "training"
  | "youth"
  | "finances"
  | "diagnostics";

export type V2Route =
  | { kind: "main"; view: V2MainViewId; path: string }
  | { kind: "player-detail"; playerId: string; path: string };

export interface V2Router {
  route: V2Route;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  goBack: (fallbackPath: string) => void;
}

interface V2HistoryState {
  atlasV2?: boolean;
  atlasV2HistoryDepth?: number;
  [key: string]: unknown;
}

const mainPaths: Record<V2MainViewId, string> = {
  dashboard: "/dashboard",
  squad: "/squad",
  training: "/training",
  youth: "/youth",
  finances: "/finances",
  diagnostics: "/diagnostics"
};

export function pathForMainView(view: V2MainViewId): string {
  return mainPaths[view];
}

export function pathForPlayerDetail(playerId: string): string {
  return `/players/${encodeURIComponent(playerId)}`;
}

export function getV2Route(pathname: string): V2Route {
  const normalizedPath = normalizePath(pathname);

  for (const [view, path] of Object.entries(mainPaths) as Array<[V2MainViewId, string]>) {
    if (normalizedPath === path) {
      return { kind: "main", path, view };
    }
  }

  const playerMatch = normalizedPath.match(/^\/players\/([^/]+)$/);

  if (playerMatch?.[1]) {
    try {
      return {
        kind: "player-detail",
        path: normalizedPath,
        playerId: decodeURIComponent(playerMatch[1])
      };
    } catch {
      return dashboardRoute();
    }
  }

  return dashboardRoute();
}

export function useV2Router(): V2Router {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);

    window.addEventListener("popstate", handlePopState);

    if (!isV2HistoryState(window.history.state)) {
      window.history.replaceState(createHistoryState(0), "", window.location.href);
    }

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const replace = useCallback((path: string) => {
    const depth = historyDepth(window.history.state);
    window.history.replaceState(createHistoryState(depth), "", path);
    setPathname(path);
  }, []);

  const navigate = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (window.location.pathname === path) {
        return;
      }

      if (options?.replace) {
        replace(path);
        return;
      }

      const depth = historyDepth(window.history.state);
      window.history.pushState(createHistoryState(depth + 1), "", path);
      setPathname(path);
    },
    [replace]
  );

  const goBack = useCallback(
    (fallbackPath: string) => {
      if (historyDepth(window.history.state) > 0) {
        window.history.back();
        return;
      }

      replace(fallbackPath);
    },
    [replace]
  );

  const route = getV2Route(pathname);

  useEffect(() => {
    if (route.path !== pathname) {
      replace(route.path);
    }
  }, [pathname, replace, route.path]);

  return { goBack, navigate, route };
}

function dashboardRoute(): V2Route {
  return { kind: "main", path: mainPaths.dashboard, view: "dashboard" };
}

function normalizePath(pathname: string): string {
  if (pathname === "/") {
    return mainPaths.dashboard;
  }

  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isV2HistoryState(value: unknown): value is V2HistoryState {
  return isRecord(value) && value.atlasV2 === true;
}

function historyDepth(value: unknown): number {
  if (!isV2HistoryState(value) || typeof value.atlasV2HistoryDepth !== "number") {
    return 0;
  }

  return Math.max(0, value.atlasV2HistoryDepth);
}

function createHistoryState(depth: number): V2HistoryState {
  const currentState = window.history.state;
  const state = isRecord(currentState) ? currentState : {};

  return {
    ...state,
    atlasV2: true,
    atlasV2HistoryDepth: depth
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

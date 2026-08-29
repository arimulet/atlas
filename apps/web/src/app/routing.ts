import { useCallback, useEffect, useState } from "react";

export type MainViewId =
  "dashboard" | "squad" | "player-decisions" | "training" | "youth" | "youth-performances" | "finances" | "diagnostics";

export type Route =
  | { kind: "main"; view: MainViewId; path: string }
  | { kind: "player-detail"; playerId: string; path: string };

export interface Router {
  route: Route;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  goBack: (fallbackPath: string) => void;
}

interface HistoryState {
  atlasHistory?: boolean;
  atlasHistoryDepth?: number;
  [key: string]: unknown;
}

const mainPaths: Record<MainViewId, string> = {
  dashboard: "/",
  squad: "/squad",
  "player-decisions": "/player-decisions",
  training: "/training",
  youth: "/youth",
  "youth-performances": "/youth/performances",
  finances: "/finances",
  diagnostics: "/diagnostics"
};

export function pathForMainView(view: MainViewId): string {
  return mainPaths[view];
}

export function pathForPlayerDetail(playerId: string): string {
  return `/player/${encodeURIComponent(playerId)}`;
}

export function getRoute(pathname: string): Route {
  const normalizedPath = normalizePath(pathname);

  for (const [view, path] of Object.entries(mainPaths) as Array<[MainViewId, string]>) {
    if (normalizedPath === path) {
      return { kind: "main", path, view };
    }
  }

  const playerMatch = normalizedPath.match(/^\/player\/([^/]+)$/);

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

export function useRouter(): Router {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);

    window.addEventListener("popstate", handlePopState);

    if (!isHistoryState(window.history.state)) {
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

  const route = getRoute(pathname);

  useEffect(() => {
    if (route.path !== pathname) {
      replace(route.path);
    }
  }, [pathname, replace, route.path]);

  return { goBack, navigate, route };
}

function dashboardRoute(): Route {
  return { kind: "main", path: mainPaths.dashboard, view: "dashboard" };
}

function normalizePath(pathname: string): string {
  if (pathname === "/") {
    return mainPaths.dashboard;
  }

  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isHistoryState(value: unknown): value is HistoryState {
  return isRecord(value) && value.atlasHistory === true;
}

function historyDepth(value: unknown): number {
  if (!isHistoryState(value) || typeof value.atlasHistoryDepth !== "number") {
    return 0;
  }

  return Math.max(0, value.atlasHistoryDepth);
}

function createHistoryState(depth: number): HistoryState {
  const currentState = window.history.state;
  const state = isRecord(currentState) ? currentState : {};

  return {
    ...state,
    atlasHistory: true,
    atlasHistoryDepth: depth
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

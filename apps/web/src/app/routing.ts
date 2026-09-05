import { useCallback } from "react";
import { usePathname, useRouter as useNextRouter } from "next/navigation";

export type MainViewId =
  | "dashboard"
  | "squad"
  | "player-decisions"
  | "training"
  | "youth"
  | "youth-performances"
  | "finances"
  | "diagnostics";

export type Route =
  | { kind: "main"; view: MainViewId; path: string }
  | { kind: "player-detail"; playerId: string; path: string };

export interface Router {
  route: Route;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  goBack: (fallbackPath: string) => void;
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
  const pathname = usePathname();
  const nextRouter = useNextRouter();

  const navigate = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (options?.replace) {
        nextRouter.replace(path);
      } else {
        nextRouter.push(path);
      }
    },
    [nextRouter]
  );

  const goBack = useCallback(
    (fallbackPath: string) => {
      if (typeof window !== "undefined" && window.history.length > 1) {
        nextRouter.back();
      } else {
        nextRouter.replace(fallbackPath);
      }
    },
    [nextRouter]
  );

  const route = getRoute(pathname || "/");

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

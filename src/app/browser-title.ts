const APPLICATION_TITLE = "Sokker ATLAS";

const pageNameByPath: Record<string, string> = {
  "/": "Dashboard",
  "/diagnostics": "Diagnostics",
  "/finances": "Finances",
  "/investment-simulator": "Investment Simulator",
  "/player-decisions": "Player Decisions",
  "/squad": "Squad",
  "/youth": "Youth",
  "/youth/performances": "Academy Performances"
};

export function formatBrowserTitle(pageName: string): string {
  return `${APPLICATION_TITLE} - ${pageName}`;
}

export function getPageNameForPath(pathname: string): string {
  if (pathname.startsWith("/player/")) {
    return "Player";
  }

  return pageNameByPath[pathname] ?? "Dashboard";
}

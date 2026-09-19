import { describe, expect, it } from "vitest";

import { formatBrowserTitle, getPageNameForPath } from "./browser-title";

describe("browser title", () => {
  it("formats page titles with the Sokker ATLAS prefix", () => {
    expect(formatBrowserTitle("Squad")).toBe("Sokker ATLAS - Squad");
  });

  it("returns the visible page name for each supported route", () => {
    expect(getPageNameForPath("/")).toBe("Dashboard");
    expect(getPageNameForPath("/youth/performances")).toBe("Academy Performances");
    expect(getPageNameForPath("/investment-simulator")).toBe("Investment Simulator");
  });

  it("uses the player fallback until player data is loaded", () => {
    expect(getPageNameForPath("/player/12345")).toBe("Player");
  });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { NavigationItem } from "@/app/types";
import { Sidebar } from "../index";

vi.mock("../../SidebarItem", () => ({
  SidebarItem: ({ item }: { item: NavigationItem }) => <span>{item.label}</span>
}));

describe("Sidebar", () => {
  it("orders squad navigation from first team through player decisions", () => {
    const html = renderToStaticMarkup(
      <Sidebar activeView="squad" diagnosticAlertCount={0} onViewChange={vi.fn()} />
    );
    const labels = ["First Team", "Youth", "Performances", "Player Decisions"];
    const positions = labels.map((label) => html.indexOf(label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
  });
});

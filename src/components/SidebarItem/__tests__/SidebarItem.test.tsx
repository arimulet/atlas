import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SidebarItem } from "../index";

describe("SidebarItem", () => {
  const item = {
    id: "squad" as const,
    label: "First Team",
    icon: <span data-testid="icon">icon</span>,
    path: "/squad"
  };

  it("renders an anchor tag with href for SSR full navigation", () => {
    const html = renderToStaticMarkup(
      <SidebarItem
        item={item}
        isActive={false}
        onSelect={vi.fn()}
      />
    );

    expect(html).toContain('href="/squad"');
    expect(html).toContain("First Team");
    expect(html).toContain("atlas-sidebar-item");
  });

  it("renders active class when isActive is true", () => {
    const html = renderToStaticMarkup(
      <SidebarItem
        item={item}
        isActive={true}
        onSelect={vi.fn()}
      />
    );

    expect(html).toContain("is-active");
    expect(html).toContain('aria-current="page"');
  });

  it("renders badgeCount when provided and positive", () => {
    const html = renderToStaticMarkup(
      <SidebarItem
        item={item}
        isActive={false}
        badgeCount={3}
        onSelect={vi.fn()}
      />
    );

    expect(html).toContain("atlas-sidebar-item__badge");
    expect(html).toContain("3");
  });
});

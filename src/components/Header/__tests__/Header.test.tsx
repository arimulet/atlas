import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Header } from "../index";

const mockUseAuth = vi.fn();
const mockUseClub = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth()
}));

vi.mock("@/context/ClubContext", () => ({
  useClub: () => mockUseClub()
}));

vi.mock("@/components/BrandLogo", () => ({
  BrandLogo: () => <div data-testid="brand-logo">ATLAS</div>
}));

describe("Header component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render team badge when user is not logged in", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    mockUseClub.mockReturnValue({ club: null, loading: false, refreshClub: vi.fn() });

    const html = renderToStaticMarkup(<Header onOpenSokkerImporter={vi.fn()} />);

    expect(html).not.toContain("atlas-team-badge");
    expect(html).not.toContain("https://sokker.org/es/app/team/");
  });

  it("does not render team badge when user is logged in but club is null", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "user@example.com" },
      logout: vi.fn()
    });
    mockUseClub.mockReturnValue({ club: null, loading: false, refreshClub: vi.fn() });

    const html = renderToStaticMarkup(<Header onOpenSokkerImporter={vi.fn()} />);

    expect(html).not.toContain("atlas-team-badge");
    expect(html).toContain("user@example.com");
  });

  it("renders prominent team badge with fictitious logo and without external link when user is logged in and club is present", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "user@example.com" },
      logout: vi.fn()
    });
    mockUseClub.mockReturnValue({
      club: {
        id: "c-1",
        clubId: 6038,
        name: "River Plate",
        country: 15,
        currency: "ARS",
        sokkerUsername: "fueguinoloko"
      },
      loading: false,
      refreshClub: vi.fn()
    });

    const html = renderToStaticMarkup(<Header onOpenSokkerImporter={vi.fn()} />);

    expect(html).toContain("atlas-team-badge");
    expect(html).toContain("atlas-team-badge__logo");
    expect(html).toContain("River Plate");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("target=\"_blank\"");
    expect(html).not.toContain("https://sokker.org/es/app/team/");
  });
});

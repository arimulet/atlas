import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mockUseAuth = vi.fn();
const mockUseClub = vi.fn();
const mockFetchPlayerDevelopment = vi.fn();
const mockFetchTrainingPageData = vi.fn();
const mockFetchClubDiagnostic = vi.fn();
const mockFetchSquadPlanning = vi.fn();
const mockFetchSquadDepthAnalysis = vi.fn();
const mockFetchSquadPlanningRecommendations = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn()
  })
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth()
}));

vi.mock("@/context/ClubContext", () => ({
  useClub: () => mockUseClub()
}));

vi.mock("@/api", () => ({
  fetchPlayerDevelopment: () => mockFetchPlayerDevelopment(),
  fetchTrainingPageData: () => mockFetchTrainingPageData(),
  fetchClubDiagnostic: () => mockFetchClubDiagnostic(),
  fetchSquadPlanning: () => mockFetchSquadPlanning(),
  fetchSquadDepthAnalysis: () => mockFetchSquadDepthAnalysis(),
  fetchSquadPlanningRecommendations: () => mockFetchSquadPlanningRecommendations(),
  syncSokker: vi.fn()
}));

vi.mock("@/components/Auth/AuthScreen", () => ({
  AuthScreen: () => <div data-testid="auth-screen">Auth Screen Content</div>
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  )
}));

vi.mock("@/components/PlayerDetail", () => ({
  PlayerDetail: (props: { clubId: string | null; currency: string | null; playerId: string }) => (
    <div data-testid="player-detail">
      Player: {props.playerId}, Club: {props.clubId ?? "none"}, Currency: {props.currency ?? "none"}
    </div>
  )
}));

import { PlayerDetailClientView } from "./PlayerDetailClientView";

describe("PlayerDetailClientView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AuthScreen when neither server nor client has an authenticated user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockUseClub.mockReturnValue({ club: null, loading: false, refreshClub: vi.fn() });

    const html = renderToStaticMarkup(
      <PlayerDetailClientView
        id="123"
        initialServerUser={null}
        initialClub={null}
      />
    );

    expect(html).toContain("Auth Screen Content");
    expect(html).not.toContain("player-detail");
  });

  it("renders PlayerDetail when authenticated via SSR even if client auth is still loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    mockUseClub.mockReturnValue({ club: null, loading: true, refreshClub: vi.fn() });

    const initialClub = {
      id: "club-abc",
      clubId: 500,
      name: "Boca Juniors",
      country: 15,
      currency: "ARS",
      sokkerUsername: "boca_mgr",
      gameWeek: 1210,
      week: 80
    };

    const html = renderToStaticMarkup(
      <PlayerDetailClientView
        id="456"
        initialServerUser={{ uid: "user-123", email: "user@test.com" }}
        initialClub={initialClub}
      />
    );

    expect(html).toContain("player-detail");
    expect(html).toContain("Player: 456, Club: club-abc, Currency: ARS");
    expect(html).not.toContain("Auth Screen Content");
  });

  it("handles null club cleanly with same behavior as existing CSR application", () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-123" }, loading: false });
    mockUseClub.mockReturnValue({ club: null, loading: false, refreshClub: vi.fn() });

    const html = renderToStaticMarkup(
      <PlayerDetailClientView
        id="789"
        initialServerUser={{ uid: "user-123" }}
        initialClub={null}
      />
    );

    expect(html).toContain("player-detail");
    expect(html).toContain("Player: 789, Club: none, Currency: none");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClubProvider, useClub } from "../ClubContext";

const mockUseAuth = vi.fn();
const mockFetchActiveClub = vi.fn();

vi.mock("../AuthContext", () => ({
  useAuth: () => mockUseAuth()
}));

vi.mock("@/api", () => ({
  fetchActiveClub: () => mockFetchActiveClub()
}));

function Consumer() {
  const { club, loading } = useClub();
  return (
    <div>
      <span id="club-name">{club?.name ?? "no-club"}</span>
      <span id="loading">{loading ? "loading" : "idle"}</span>
    </div>
  );
}

describe("ClubContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports useClub and ClubProvider", () => {
    expect(typeof ClubProvider).toBe("function");
    expect(typeof useClub).toBe("function");
  });

  it("renders children and provides default context when not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    const html = renderToStaticMarkup(
      <ClubProvider>
        <Consumer />
      </ClubProvider>
    );

    expect(html).toContain("no-club");
    expect(html).toContain("idle");
  });
});

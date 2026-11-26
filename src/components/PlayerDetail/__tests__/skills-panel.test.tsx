import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn()
  }),
  usePathname: () => "/player/101"
}));

import { PlayerDetail } from "../index";
import type { PlayerDetailProps } from "../types";

describe("PlayerDetail - Skills section format", () => {
  it("renders skills in '{skillName} [{skillNumber}]' format and optional '+n' or '-n' delta", () => {
    const props: PlayerDetailProps = {
      playerId: "101",
      clubId: "1",
      currency: "USD",
      trainingStatus: "ready",
      trainingDiagnostic: null,
      training: {
        snapshotId: "s-1",
        snapshotDate: "2026-08-14",
        configuration: { GK: 2, DEF: 6, MID: 3, ATT: 7 },
        players: [
          {
            id: "101",
            playerId: 101,
            name: "Test Striker",
            age: 19,
            training: { position: 4, advanced: true },
            latestReport: {
              playerId: 101,
              gameWeek: 1200,
              season: 17,
              seasonWeek: 10,
              date: "2026-08-14",
              type: "scoring",
              kind: "advanced",
              intensity: 100,
              age: 19,
              skills: { striker: 8, pace: 6 },
              skillsChange: { striker: 1 }
            }
          }
        ],
        history: [
          {
            playerId: 101,
            gameWeek: 1200,
            season: 17,
            seasonWeek: 10,
            date: "2026-08-14",
            type: "scoring",
            kind: "advanced",
            intensity: 100,
            age: 19,
            skills: { striker: 8, pace: 6 },
            skillsChange: { striker: 1 },
            skillChanges: [
              { skill: "striker", before: 7, after: 8, delta: 1, direction: "up" }
            ]
          }
        ]
      },
      development: {
        clubId: "1",
        snapshotCount: 1,
        snapshotDates: ["2026-08-14"],
        observed: {
          latestSnapshotId: "s-1",
          latestSnapshotDate: "2026-08-14",
          players: [
            {
              playerId: "101",
              snapshotPlayerId: "101",
              externalId: "ext-101",
              name: "Test Striker",
              age: 19,
              observedPosition: "striker",
              skills: {
                stamina: 5,
                keeper: 0,
                pace: 6,
                defender: 2,
                technique: 7,
                playmaker: 4,
                passing: 5,
                striker: 8
              }
            }
          ]
        },
        manual: { trainingPriority: "striker" },
        derived: { players: [] },
        warnings: []
      },
      squadPlanning: null,
      onBack: () => {},
      onBackToSquad: () => {}
    };

    const html = renderToStaticMarkup(<PlayerDetail {...props} />);

    // Striker had a +1 pop to 8 (solid) -> rendered as solid [8] +1
    expect(html).toContain('<span class="atlas-player-detail__skill-name">solid</span>');
    expect(html).toContain('<span class="atlas-player-detail__skill-level">[8]</span>');
    expect(html).toContain('<span aria-label="Last week: gained 1 skill level" class="atlas-player-detail__skill-change is-up">+1</span>');

    // Pace was 6 (adequate) with no change -> rendered as adequate [6]
    expect(html).toContain('<span class="atlas-player-detail__skill-name">adequate</span>');
    expect(html).toContain('<span class="atlas-player-detail__skill-level">[6]</span>');
  });
});

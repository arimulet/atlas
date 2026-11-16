import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { TrainingPageData } from "@atlas/web/app/types";
import { TrainingPlayerTables } from "../TrainingPlayerTables";

describe("TrainingPlayerTables", () => {
  it("shows changes from the last completed week instead of a future report", () => {
    const completed = {
      playerId: 42, gameWeek: 1200, seasonWeek: 2, date: "2026-01-01",
      type: "pace", kind: "advanced" as const, intensity: 100, age: 20,
      skills: { pace: 12, passing: 7 }, skillsChange: { pace: 1, passing: -1, up: 1, down: 1 },
      skillChanges: []
    };
    const future = { ...completed, gameWeek: 1201, date: "2099-01-01", intensity: 0,
      skillsChange: { pace: 0, passing: 0, up: 0, down: 0 } };
    const players: TrainingPageData["players"] = [{
      id: "player-1", playerId: 42, name: "Player One", age: 20,
      skills: { pace: 12, passing: 7 }, training: { position: 1, advanced: true },
      latestReport: future
    }];

    const html = renderToStaticMarkup(
      <TrainingPlayerTables configuration={null} diagnostic={null} history={[future, completed]}
        onSelectPlayer={vi.fn()} players={players} projectionSummaries={undefined}
        recommendations={new Map()} />
    );

    const cells = [...html.matchAll(/<td class="([^"]*atlas-training-table__skill[^"]*)"[^>]*>(.*?)<\/td>/g)];
    expect(cells[2]?.[1]).toContain("is-skill-up");
    expect(cells[4]?.[1]).toContain("is-skill-down");
  });

  it("shows rises and falls from the latest report even when report skill levels are missing", () => {
    const players: TrainingPageData["players"] = [{
      id: "snapshot-player-1",
      playerId: 42,
      name: "Player One",
      age: 20,
      skills: { pace: 12, defender: 8, playmaker: 10, passing: 7 },
      training: { position: 1, advanced: true },
      latestReport: {
        playerId: 42,
        gameWeek: 1200,
        seasonWeek: 2,
        date: "2026-01-01",
        type: "pace",
        kind: "advanced",
        intensity: 100,
        age: 20,
        skills: {},
        skillsChange: { pace: 1, defending: -1, playmaking: 1, passing: 0, up: 2, down: 1 },
        skillChanges: []
      }
    }];

    const html = renderToStaticMarkup(
      <TrainingPlayerTables
        configuration={null}
        diagnostic={null}
        history={[]}
        onSelectPlayer={vi.fn()}
        players={players}
        projectionSummaries={undefined}
        recommendations={new Map()}
      />
    );

    const skillCells = [...html.matchAll(/<td class="([^"]*atlas-training-table__skill[^"]*)"[^>]*>(.*?)<\/td>/g)];
    expect(skillCells).toHaveLength(9);
    expect(skillCells[2]?.[1]).toContain("is-skill-up");
    expect(skillCells[6]?.[1]).toContain("is-skill-down");
    expect(skillCells[7]?.[1]).toContain("is-skill-up");
    expect(skillCells[4]?.[1]).not.toContain("is-skill-");
    expect(skillCells[2]?.[2]).toContain("atlas-training-table__skill-marker");
    expect(skillCells[6]?.[2]).toContain("atlas-training-table__skill-marker");
  });

  it("uses snapshot skills for a new player without a training report", () => {
    const players: TrainingPageData["players"] = [
      {
        id: "snapshot-player-1",
        playerId: 39691693,
        name: "Fikret Erkan",
        age: 26,
        form: 9,
        skills: {
          stamina: 11,
          pace: 15,
          technique: 9,
          passing: 6,
          keeper: 0,
          defender: 15,
          playmaker: 8,
          striker: 8
        },
        training: { position: 1, advanced: false },
        value: 752750,
        valueChange: null,
        latestReport: null,
        talentEstimate: null
      }
    ];

    const html = renderToStaticMarkup(
      <TrainingPlayerTables
        configuration={null}
        diagnostic={null}
        history={[]}
        onSelectPlayer={vi.fn()}
        players={players}
        projectionSummaries={undefined}
        recommendations={new Map()}
      />
    );

    expect(html).toContain(">11</span>");
    expect(html).toContain(">15</span>");
    expect(html).toContain(">9</span>");
  });
});

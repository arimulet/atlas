import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { TrainingPageData } from "@atlas/web/app/types";
import { TrainingPlayerTables } from "../TrainingPlayerTables";

describe("TrainingPlayerTables", () => {
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

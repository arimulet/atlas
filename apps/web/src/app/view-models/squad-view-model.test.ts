import { describe, expect, it } from "vitest";

import type { PlayerDevelopment, TrainingPageData } from "@atlas/web/app/types";
import { createSquadPlayerRows, isSquadSkillRequiredForPosition } from "./squad-view-model";

describe("createSquadPlayerRows", () => {
  it("identifies the skills required for each training position", () => {
    expect(isSquadSkillRequiredForPosition("GK", "keeper")).toBe(true);
    expect(isSquadSkillRequiredForPosition("DEF", "defender")).toBe(true);
    expect(isSquadSkillRequiredForPosition("DEF", "playmaker")).toBe(false);
    expect(isSquadSkillRequiredForPosition("MID", "playmaker")).toBe(true);
    expect(isSquadSkillRequiredForPosition("ATT", "striker")).toBe(true);
    expect(isSquadSkillRequiredForPosition("ATT", "passing")).toBe(false);
    expect(isSquadSkillRequiredForPosition("GK", "striker")).toBe(false);
  });

  it("maps the shared training projection summary without deriving development values", () => {
    const training: TrainingPageData = {
      snapshotId: "snapshot-1",
      snapshotDate: "2026-08-14",
      configuration: { GK: 2, DEF: 6, MID: 3, ATT: 7 },
      players: [
        {
          id: "snapshot-player-1",
          playerId: 42,
          name: "Player One",
          age: 18,
          form: 17,
          training: { position: 2, advanced: true }
        }
      ]
    };
    const development: PlayerDevelopment = {
      clubId: "club-1",
      snapshotCount: 1,
      snapshotDates: ["2026-08-14"],
      observed: {
        latestSnapshotId: "snapshot-1",
        latestSnapshotDate: "2026-08-14",
        players: [
          {
            playerId: "42",
            externalId: "42",
            snapshotPlayerId: "snapshot-player-1",
            name: "Player One",
            age: 18,
            observedPosition: "midfielder",
            skills: { playmaker: 13 }
          }
        ]
      },
      manual: { trainingPriority: "balanced" },
      derived: { players: [] },
      warnings: []
    };

    const rows = createSquadPlayerRows({
      development,
      projectionSummaries: new Map([
        ["42", { playerId: "42", progress: 82, talent: 3.4, nextSkillUp: 14, etaWeeks: 2 }]
      ]),
      training,
      trainingDiagnostic: null,
      trainingStatus: "ready"
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        form: 17,
        training: expect.objectContaining({ progress: 82 }),
        development: { talent: 3.4, nextSkillUp: 14, etaWeeks: 2 }
      })
    );
  });
});

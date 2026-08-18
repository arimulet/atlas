import { describe, expect, it } from "vitest";

import type { PlayerDevelopment, TrainingPageData } from "@atlas/web/app/types";
import { createPlayerDetailViewModel } from "./player-detail-view-model";

describe("createPlayerDetailViewModel", () => {
  it("uses the configured training skill for the projection current state", () => {
    const training: TrainingPageData = {
      snapshotId: "snapshot-1",
      snapshotDate: "2026-08-14",
      configuration: { GK: 2, DEF: 6, MID: 3, ATT: 7 },
      players: [
        {
          id: "snapshot-player-1",
          name: "Player One",
          age: 20,
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
            age: 20,
            observedPosition: "midfielder",
            skills: { playmaker: 12 }
          }
        ]
      },
      manual: { trainingPriority: "balanced" },
      derived: { players: [] },
      warnings: []
    };

    const viewModel = createPlayerDetailViewModel({
      playerId: "snapshot-player-1",
      training,
      development,
      trainingDiagnostic: null,
      trainingStatus: "ready"
    });

    expect(viewModel?.projection.current).toEqual({
      skill: "Creacion",
      level: 12,
      progress: null
    });
    expect(viewModel?.talent.estimated).toBeNull();
    expect(viewModel?.projection.nextSkillUp).toBeUndefined();
    expect(viewModel?.projection.horizon).toBeUndefined();
  });

  it("matches a professional id when the API returns it as a number", () => {
    const training: TrainingPageData = {
      snapshotId: "snapshot-1",
      snapshotDate: "2026-08-14",
      configuration: { GK: 2, DEF: 6, MID: 3, ATT: 7 },
      players: [
        {
          id: "snapshot-player-1",
          name: "Player One",
          age: 20,
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
            playerId: 42 as unknown as string,
            externalId: "42",
            snapshotPlayerId: "snapshot-player-1",
            name: "Player One",
            age: 20,
            observedPosition: "midfielder",
            skills: { playmaker: 12 }
          }
        ]
      },
      manual: { trainingPriority: "balanced" },
      derived: { players: [] },
      warnings: []
    };

    const viewModel = createPlayerDetailViewModel({
      playerId: "42",
      training,
      development,
      trainingDiagnostic: null,
      trainingStatus: "ready"
    });

    expect(viewModel?.player.name).toBe("Player One");
  });
});

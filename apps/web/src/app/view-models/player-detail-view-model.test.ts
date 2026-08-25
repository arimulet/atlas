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
          playerId: 42,
          name: "Player One",
          age: 20,
          training: { position: 2, advanced: true },
          latestReport: {
            playerId: 42,
            gameWeek: 1200,
            seasonWeek: 20,
            date: "2026-08-14",
            type: "playmaking",
            kind: "advanced",
            intensity: 100,
            age: 20,
            skills: { playmaking: 12, defending: 7 },
            skillsChange: { playmaking: 1, defending: -1 },
            skillChanges: [
              {
                skill: "playmaking",
                before: 11,
                after: 12,
                delta: 1,
                direction: "up"
              },
              {
                skill: "defending",
                before: 8,
                after: 7,
                delta: -1,
                direction: "down"
              }
            ]
          }
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
            skills: { playmaker: 12, defender: 7 }
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

    expect(viewModel?.projection.current).toEqual({
      skill: "Creacion",
      level: 12,
      progress: null
    });
    expect(viewModel?.talent.estimated).toBeNull();
    expect(viewModel?.projection.nextSkillUp).toBeUndefined();
    expect(viewModel?.projection.horizon).toBeUndefined();
    expect(viewModel?.skills.find((skill) => skill.key === "playmaker")).toMatchObject({
      value: 12,
      levelLabel: "destacado",
      isImportant: true,
      lastWeekChange: { direction: "up", levelDelta: 1 }
    });
    expect(viewModel?.skills.find((skill) => skill.key === "defender")).toMatchObject({
      value: 7,
      isImportant: false,
      lastWeekChange: { direction: "down", levelDelta: 1 }
    });
  });

  it("matches a professional id when the API returns it as a number", () => {
    const training: TrainingPageData = {
      snapshotId: "snapshot-1",
      snapshotDate: "2026-08-14",
      configuration: { GK: 2, DEF: 6, MID: 3, ATT: 7 },
      players: [
        {
          id: "snapshot-player-1",
          playerId: 42,
          name: "Player One",
          age: 20,
          training: { position: 2, advanced: true },
          latestReport: {
            playerId: 42,
            gameWeek: 1200,
            seasonWeek: 20,
            date: "2026-08-14",
            type: "playmaking",
            kind: "advanced",
            intensity: 100,
            age: 20,
            skills: { playmaking: 12, defending: 7 },
            skillsChange: { playmaking: 1, defending: -1 },
            skillChanges: [
              {
                skill: "playmaking",
                before: 11,
                after: 12,
                delta: 1,
                direction: "up"
              },
              {
                skill: "defending",
                before: 8,
                after: 7,
                delta: -1,
                direction: "down"
              }
            ]
          }
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
            observedPosition: null,
            skills: { playmaker: 12, defender: 7 }
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
    expect(viewModel?.skills.find((skill) => skill.key === "playmaker")).toMatchObject({
      isImportant: true
    });
  });
});

import { describe, expect, it } from "vitest";

import type { PlayerDevelopment, TrainingPageData } from "@atlas/web/app/types";
import { createPlayerDetailViewModel } from "./player-detail-view-model";

describe("createPlayerDetailViewModel", () => {
  it("uses the configured training skill for the projection current state", () => {
    const training: TrainingPageData = {
      snapshotId: "snapshot-1",
      snapshotDate: "2026-08-14",
      configuration: { GK: 2, DEF: 6, MID: 3, ATT: 7 },
      history: [
        {
          playerId: 42,
          gameWeek: 1200,
          season: 17,
          seasonWeek: 12,
          date: "2026-08-14",
          type: "playmaking",
          kind: "advanced",
          intensity: 100,
          age: 20,
          skills: {
            stamina: 8,
            pace: 10,
            technique: 9,
            passing: 11,
            keeper: 3,
            defending: 7,
            playmaker: 12,
            striker: 6
          },
          skillsChange: { playmaking: 1, defending: -1 },
          skillChanges: [
            { skill: "playmaking", before: 11, after: 12, delta: 1, direction: "up" },
            { skill: "defending", before: 8, after: 7, delta: -1, direction: "down" }
          ]
        },
        {
          playerId: 42,
          gameWeek: 1199,
          season: 17,
          seasonWeek: 11,
          date: "2026-08-07",
          type: "defending",
          kind: "formation",
          intensity: 85,
          age: 20,
          skills: { defending: 8, playmaking: 12 },
          skillsChange: {}
        },
        {
          playerId: 42,
          gameWeek: 1198,
          season: 17,
          seasonWeek: 10,
          date: "2026-07-31",
          type: "general",
          kind: "missing",
          intensity: 0,
          age: 20,
          skills: { playmaking: 11 },
          skillsChange: {}
        }
      ],
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
    const history = viewModel?.trainingHistory ?? [];
    expect(history.map((row) => row.seasonWeek)).toEqual([12, 11, 10]);
    expect(history[0]!).toMatchObject({
      season: 17,
      type: "Creacion",
      kind: "advanced",
      intensity: 100
    });
    expect(history[0]!.skills.map((skill) => skill.key)).toEqual([
      "stamina",
      "pace",
      "technique",
      "passing",
      "keeper",
      "defender",
      "playmaker",
      "striker"
    ]);
    expect(history[1]!.skills.find((skill) => skill.key === "playmaker")).toMatchObject({
      value: 12,
      levelLabel: "destacado",
      change: { direction: "up", levelDelta: 1 }
    });
    expect(history[1]!.skills.find((skill) => skill.key === "defender")).toMatchObject({
      value: 8,
      change: null
    });
    expect(history[2]!).toMatchObject({ kind: "missing", type: "General" });
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

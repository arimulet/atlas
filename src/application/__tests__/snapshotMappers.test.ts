import { describe, expect, it } from "vitest";

import { mapPlayersToSnapshotPlayers } from "../importer/snapshot-mappers.js";
import type { PlayerDto, PlayerTrainingWeekDto } from "../importer/types.js";

describe("mapPlayersToSnapshotPlayers", () => {
  it("infers a field position from skills when a promoted player has no formation", () => {
    const [player] = mapPlayersToSnapshotPlayers(
      [
        createPlayer({
          formation: null,
          skills: {
            stamina: 8,
            pace: 13,
            technique: 11,
            passing: 7,
            keeper: 1,
            defending: 3,
            playmaking: 4,
            striker: 15,
            form: 12,
            tacticalDiscipline: 5,
            teamwork: 5,
            experience: 5
          }
        })
      ],
      []
    );

    expect(player?.training.position).toBe(3);
  });

  it("preserves the formation when Sokker provides it", () => {
    const [player] = mapPlayersToSnapshotPlayers([createPlayer({ formation: "GK" })], []);

    expect(player?.training.position).toBe(0);
  });

  it("preserves historical trained formation in snapshot even if player has a different live formation", () => {
    const player = createPlayer({ id: 42, formation: "DEF" });
    const trainingWeek: PlayerTrainingWeekDto = {
      playerId: 42,
      gameWeek: 1204,
      season: 78,
      seasonWeek: 7,
      date: "2026-08-12",
      trainedSkill: "playmaking",
      kind: "formation",
      intensity: 100,
      formation: "MID",
      age: 20,
      skills: player.skills,
      skillsChange: {
        form: 0,
        tacticalDiscipline: 0,
        teamwork: 0,
        experience: 0,
        stamina: 0,
        keeper: 0,
        playmaking: 0,
        passing: 0,
        technique: 0,
        defending: 0,
        striker: 0,
        pace: 0,
        down: 0,
        up: 0
      },
      skillChanges: []
    };

    const [snapshotPlayer] = mapPlayersToSnapshotPlayers([player], [trainingWeek]);

    expect(snapshotPlayer?.training.position).toBe(2);
  });
});

function createPlayer(overrides: Partial<PlayerDto> = {}): PlayerDto {
  return {
    id: 42,
    teamId: 7,
    name: { firstName: "Eduardo", lastName: "Cahen", fullName: "Eduardo Cahen" },
    country: { code: 1, name: "Argentina" },
    value: { value: 1_000_000, currency: "ARS" },
    wage: { value: 10_000, currency: "ARS" },
    age: 18,
    height: 180,
    weight: 75,
    bmi: 23,
    skills: {
      stamina: 8,
      pace: 8,
      technique: 8,
      passing: 8,
      keeper: 1,
      defending: 8,
      playmaking: 8,
      striker: 8,
      form: 12,
      tacticalDiscipline: 5,
      teamwork: 5,
      experience: 5
    },
    formation: "MID",
    injury: { daysRemaining: 0, severe: false },
    cards: { yellow: 0, red: 0 },
    youthTeamId: 0,
    nationalCallUp: false,
    nationalType: "none",
    ...overrides
  };
}

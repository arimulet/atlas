import { describe, expect, it } from "vitest";

import { mapPlayersToSnapshotPlayers } from "../src/importer/snapshot-mappers.js";
import type { PlayerDto } from "../src/importer/types.js";

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

import type { PersistedSnapshot } from "@atlas/database";
import { describe, expect, it } from "vitest";

import { createSnapshotDiagnostic } from "./index.js";

describe("createSnapshotDiagnostic", () => {
  it("maps the persisted snapshot to the diagnostic engine", () => {
    const snapshot = createSnapshot();

    const diagnostic = createSnapshotDiagnostic(snapshot, "EUR");

    expect(diagnostic.snapshotId).toBe("snapshot-1");
    expect(diagnostic.generatedAt).toBe("2026-08-25T12:00:00.000Z");

    const economicRisk = diagnostic.findings.find(
      (finding) => finding.code === "economic-risk.high-wage-low-value-ratio"
    );

    expect(economicRisk?.parameters).toMatchObject({
      playerName: "Marco Rossi",
      wage: 160_000,
      value: 1_000_000
    });
    expect(economicRisk?.evidence).toContainEqual(
      expect.objectContaining({
        code: "player.wage",
        parameters: { playerName: "Marco Rossi" }
      })
    );
    expect(
      diagnostic.findings.some((finding) => finding.code === "follow-up.incomplete-player-data")
    ).toBe(true);
  });
});

function createSnapshot(): PersistedSnapshot {
  return {
    id: "snapshot-1",
    clubId: 77,
    schemaVersion: "atlas.player-snapshot.v0",
    snapshotDate: new Date("2026-08-25T00:00:00.000Z"),
    gameWeek: 5,
    week: 5,
    importedAt: new Date("2026-08-25T12:00:00.000Z"),
    players: [
      {
        id: "player-snapshot-1",
        playerId: 101,
        name: "Marco Rossi",
        countryName: "Italia",
        age: 31,
        wage: 160_000,
        value: 1_000_000,
        training: { position: 1, advanced: true },
        form: null,
        availabilityStatus: null,
        observedPosition: "defender",
        skills: {
          stamina: 8,
          pace: 9,
          technique: 7,
          passing: 7,
          keeper: 1,
          defender: 11,
          playmaker: 6,
          striker: 5
        }
      },
      {
        id: "player-snapshot-2",
        playerId: 102,
        name: "Luis Costa",
        countryName: "España",
        age: 23,
        wage: 50_000,
        value: 2_000_000,
        training: { position: 2, advanced: false },
        form: 7,
        availabilityStatus: "available",
        observedPosition: "midfielder",
        skills: {
          stamina: 9,
          pace: 9,
          technique: 9,
          passing: 9,
          keeper: 1,
          defender: 5,
          playmaker: 10,
          striker: 6
        }
      }
    ],
    juniors: []
  };
}

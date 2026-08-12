import { describe, expect, it } from "vitest";
import { generateHistoricalFindings, type SnapshotComparisonSnapshot } from "../src/index.js";

describe("generateHistoricalFindings", () => {
  it("detects sustained patrimonial appreciation with evidence and action", () => {
    const findings = generateHistoricalFindings([
      snapshot({ id: "s-1", snapshotDate: "2026-08-01", value: 400000 }),
      snapshot({ id: "s-2", snapshotDate: "2026-08-08", value: 450000 }),
      snapshot({ id: "s-3", snapshotDate: "2026-08-15", value: 500000, pace: 11 })
    ]);

    expect(findings.findings).toContainEqual(
      expect.objectContaining({
        type: "player_sustained_asset_appreciation",
        severity: "info",
        confidence: "high",
        subject: { kind: "player", playerId: 1001, playerName: "Tomas Alvarez" },
        period: {
          fromSnapshotId: "s-1",
          toSnapshotId: "s-3",
          fromDate: "2026-08-01",
          toDate: "2026-08-15",
          dataPoints: 3
        },
        actionSuggested: expect.stringContaining("Monitor retention")
      })
    );
  });

  it("detects patrimonial deterioration", () => {
    const findings = generateHistoricalFindings([
      snapshot({ id: "s-1", value: 500000 }),
      snapshot({ id: "s-2", value: 425000 })
    ]);

    expect(findings.findings[0]).toMatchObject({
      type: "player_asset_or_sporting_deterioration",
      severity: "medium",
      confidence: "medium",
      evidence: expect.arrayContaining([
        expect.objectContaining({
          kind: "derived",
          metric: "value.deltaPercentage",
          value: -15
        })
      ])
    });
  });

  it("detects stagnation only with enough historical evidence", () => {
    const findings = generateHistoricalFindings([
      snapshot({ id: "s-1", value: 500000 }),
      snapshot({ id: "s-2", value: 505000 }),
      snapshot({ id: "s-3", value: 500000 })
    ]);

    expect(findings.findings[0]?.type).toBe("player_stagnation");
  });

  it("detects risky wage against weak asset evolution", () => {
    const findings = generateHistoricalFindings([
      snapshot({ id: "s-1", wage: 10000, value: 500000 }),
      snapshot({ id: "s-2", wage: 13000, value: 500000 })
    ]);

    expect(findings.findings[0]).toMatchObject({
      type: "risky_wage_against_historical_evolution",
      severity: "high",
      evidence: expect.arrayContaining([
        expect.objectContaining({ metric: "wage.deltaPercentage", value: 30 })
      ])
    });
  });

  it("generates aggregate squad findings when value deteriorates and wage does not fall", () => {
    const findings = generateHistoricalFindings([
      snapshot({ id: "s-1", value: 500000, wage: 10000 }),
      snapshot({ id: "s-2", value: 430000, wage: 11000 })
    ]);

    const squadFinding = findings.findings.find((finding) => finding.type === "squad_asset_evolution");
    const valueEvidence = squadFinding?.evidence.find(
      (entry) => entry.metric === "squad.value.deltaPercentage"
    );

    expect(squadFinding).toMatchObject({
      type: "squad_asset_evolution",
      subject: { kind: "squad", clubId: "club-1" }
    });
    expect(valueEvidence?.value).toBeCloseTo(-14);
  });

  it("does not generate findings when data is insufficient or player identity is ambiguous", () => {
    const singleSnapshot = generateHistoricalFindings([snapshot({ id: "s-1" })]);
    const ambiguous = generateHistoricalFindings([
      snapshot({ id: "s-1", playerId: null, value: 400000 }),
      snapshot({ id: "s-2", playerId: null, value: 500000 })
    ]);

    expect(singleSnapshot.findings).toEqual([]);
    expect(singleSnapshot.warnings).toContain(
      "At least two snapshots are required for historical findings."
    );
    expect(ambiguous.findings).toEqual([]);
  });
});

function snapshot(overrides: {
  id?: string;
  clubId?: string;
  snapshotDate?: string;
  playerId?: number | null;
  wage?: number;
  value?: number;
  pace?: number | null;
} = {}): SnapshotComparisonSnapshot {
  return {
    id: overrides.id ?? "s-1",
    clubId: overrides.clubId ?? "club-1",
    snapshotDate: overrides.snapshotDate ?? "2026-08-05",
    players: [
      {
        id: `${overrides.id ?? "s-1"}-player-1`,
        playerId: overrides.playerId === undefined ? 1001 : overrides.playerId,
        name: "Tomas Alvarez",
        age: 24,
        wage: { amount: overrides.wage ?? 12000, currency: "ARS" },
        value: { amount: overrides.value ?? 450000, currency: "ARS" },
        skills: {
          stamina: 9,
          pace: overrides.pace === undefined ? 10 : overrides.pace,
          technique: 8,
          passing: 7,
          keeper: 1,
          defender: 5,
          playmaker: 6,
          striker: 4
        }
      }
    ]
  };
}

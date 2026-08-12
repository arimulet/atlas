import { describe, expect, it } from "vitest";
import {
  generateBasicDiagnostic,
  type BasicDiagnosticPlayerSnapshot,
  type BasicDiagnosticSnapshot
} from "../src/index.js";

describe("generateBasicDiagnostic", () => {
  it("generates a diagnostic from a valid snapshot", () => {
    const diagnostic = generateBasicDiagnostic(
      buildSnapshot(),
      new Date("2026-08-05T21:00:00.000Z")
    );

    expect(diagnostic.snapshotId).toBe("snapshot-001");
    expect(diagnostic.generatedAt).toBe("2026-08-05T21:00:00.000Z");
    expect(diagnostic.findings.length).toBeGreaterThan(0);
  });

  it("detects squad role imbalance", () => {
    const diagnostic = generateBasicDiagnostic(
      buildSnapshot({ players: [player({ observedPosition: "midfielder" })] })
    );

    const finding = diagnostic.findings.find((item) => item.category === "squad-balance");

    expect(finding).toMatchObject({
      code: "squad-balance.goalkeeper.deficit",
      severity: "medium",
      confidence: "high"
    });
    expect(finding?.evidence.some((trace) => trace.kind === "derived")).toBe(true);
    expect(finding?.assumptions.map((assumption) => assumption.code)).toContain("role-baseline");
  });

  it("detects economic risk from high wage", () => {
    const diagnostic = generateBasicDiagnostic(
      buildSnapshot({
        players: [
          player({
            id: "ps-1",
            playerId: 1001,
            name: "Balanced Midfielder",
            wageAmount: 10000,
            valueAmount: 600000
          }),
          player({
            id: "ps-2",
            playerId: 1002,
            name: "Expensive Veteran",
            wageAmount: 30000,
            valueAmount: 450000
          })
        ]
      })
    );

    const finding = diagnostic.findings.find((item) => item.category === "economic-risk");

    expect(finding).toMatchObject({
      code: "economic-risk.high-wage-low-value-ratio",
      severity: "medium",
      affectedPlayerIds: ["1002"]
    });
    expect(finding?.evidence.map((trace) => trace.label)).toContain(
      "Expensive Veteran value-to-wage ratio"
    );
  });

  it("detects asset risk from age and value", () => {
    const diagnostic = generateBasicDiagnostic(
      buildSnapshot({
        players: [
          player({
            name: "Senior Asset",
            age: 32,
            valueAmount: 700000,
            observedPosition: "defender"
          })
        ]
      })
    );

    const finding = diagnostic.findings.find((item) => item.category === "asset-risk");

    expect(finding).toMatchObject({
      code: "asset-risk.senior-high-value",
      severity: "high"
    });
    expect(finding?.evidence.map((trace) => trace.kind)).toContain("observed");
  });

  it("identifies training potential", () => {
    const diagnostic = generateBasicDiagnostic(
      buildSnapshot({
        players: [
          player({
            name: "Young Prospect",
            age: 20,
            observedPosition: "striker",
            striker: 10,
            technique: 9,
            pace: 9
          })
        ]
      })
    );

    const finding = diagnostic.findings.find((item) => item.category === "training-potential");

    expect(finding).toMatchObject({
      code: "training-potential.young-role-fit",
      severity: "low",
      confidence: "high"
    });
    expect(finding?.affectedPlayerIds).toEqual(["1001"]);
  });

  it("marks follow-up when data is missing", () => {
    const diagnostic = generateBasicDiagnostic(
      buildSnapshot({
        players: [
          player({
            playerId: null,
            form: null,
            availabilityStatus: null,
            observedPosition: null,
            currency: null,
            technique: null
          })
        ]
      })
    );

    const finding = diagnostic.findings.find((item) => item.category === "follow-up");

    expect(finding).toMatchObject({
      code: "follow-up.incomplete-player-data",
      severity: "medium",
      confidence: "low"
    });
    expect(finding?.assumptions.map((assumption) => assumption.code)).toContain(
      "missing-player-id"
    );
    expect(finding?.evidence.map((trace) => trace.label)).toContain(
      "Tomas Alvarez missing skills.technique"
    );
  });

  it("includes evidence and assumptions in every finding", () => {
    const diagnostic = generateBasicDiagnostic(
      buildSnapshot({ players: [player({ playerId: null })] })
    );

    expect(diagnostic.findings.length).toBeGreaterThan(0);
    diagnostic.findings.forEach((finding) => {
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(finding.assumptions.length).toBeGreaterThan(0);
    });
  });

  it("does not generate recommendations without explanation", () => {
    const diagnostic = generateBasicDiagnostic(
      buildSnapshot({ players: [player({ playerId: null })] })
    );

    diagnostic.findings
      .flatMap((finding) => finding.recommendations)
      .forEach((recommendation) => {
        expect(recommendation.traceKind).toBe("recommended");
        expect(recommendation.description.length).toBeGreaterThan(0);
        expect(recommendation.rationale.length).toBeGreaterThan(0);
      });
  });
});

function buildSnapshot(overrides: Partial<BasicDiagnosticSnapshot> = {}): BasicDiagnosticSnapshot {
  return {
    id: "snapshot-001",
    players: [player()],
    ...overrides
  };
}

function player(overrides: PartialPlayer = {}): BasicDiagnosticPlayerSnapshot {
  return {
    id: overrides.id ?? "player-snapshot-001",
    playerId: overrides.playerId === undefined ? 1001 : overrides.playerId,
    name: overrides.name ?? "Tomas Alvarez",
    age: overrides.age ?? 22,
    wage: {
      amount: overrides.wageAmount ?? 12000,
      currency: overrides.currency === undefined ? "ARS" : overrides.currency
    },
    value: {
      amount: overrides.valueAmount ?? 450000,
      currency: overrides.currency === undefined ? "ARS" : overrides.currency
    },
    form: overrides.form === undefined ? 10 : overrides.form,
    availabilityStatus:
      overrides.availabilityStatus === undefined ? "available" : overrides.availabilityStatus,
    observedPosition:
      overrides.observedPosition === undefined ? "midfielder" : overrides.observedPosition,
    skills: {
      stamina: overrides.stamina ?? 8,
      pace: overrides.pace ?? 10,
      technique: overrides.technique === undefined ? 9 : overrides.technique,
      passing: overrides.passing ?? 8,
      keeper: overrides.keeper ?? 1,
      defender: overrides.defender ?? 5,
      playmaker: overrides.playmaker ?? 9,
      striker: overrides.striker ?? 4
    }
  };
}

interface PartialPlayer {
  id?: string;
  playerId?: number | null;
  name?: string;
  age?: number;
  wageAmount?: number;
  valueAmount?: number;
  currency?: string | null;
  form?: number | null;
  availabilityStatus?: BasicDiagnosticPlayerSnapshot["availabilityStatus"];
  observedPosition?: string | null;
  stamina?: number | null;
  pace?: number | null;
  technique?: number | null;
  passing?: number | null;
  keeper?: number | null;
  defender?: number | null;
  playmaker?: number | null;
  striker?: number | null;
}

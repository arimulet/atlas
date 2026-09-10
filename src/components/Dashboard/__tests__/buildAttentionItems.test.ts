import { describe, expect, it } from "vitest";
import { buildAttentionItems } from "../index";
import type {
  ClubDashboard,
  DiagnosticFinding,
  RealYouthAcademyPlanning
} from "@atlas/web/app/types";

describe("buildAttentionItems", () => {
  it("returns empty array when no data is provided", () => {
    const items = buildAttentionItems(null, null, null);
    expect(items).toEqual([]);
  });

  it("formats squad-balance and economic diagnostic findings in English with player links", () => {
    const diagnostic = {
      findings: [
        createDiagnosticFinding({
          code: "squad-balance.midfielder.deficit",
          category: "squad-balance",
          severity: "medium",
          parameters: { role: "midfielder", currentCount: 1, minimum: 3 }
        }),
        createDiagnosticFinding({
          code: "economic-risk.high-wage-low-value-ratio",
          category: "economic-risk",
          severity: "high",
          parameters: { playerName: "High Wage Star", wage: 150000, value: 500000 },
          affectedPlayerIds: ["p-101"]
        }),
        createDiagnosticFinding({
          code: "asset-risk.senior-high-value",
          category: "asset-risk",
          severity: "high",
          parameters: { playerName: "Aging Maestro", value: 3000000 },
          affectedPlayerIds: ["p-102"]
        })
      ]
    };

    const items = buildAttentionItems(null, null, diagnostic);

    expect(items).toHaveLength(3);
    // High severity items should come before medium
    expect(items[0]?.severity).toBe("high");
    expect(items[1]?.severity).toBe("high");
    expect(items[2]?.severity).toBe("medium");

    const squadBalance = items.find((item) => item.id.includes("squad-balance"));
    expect(squadBalance).toBeDefined();
    expect(squadBalance?.name).toBe("Squad");
    expect(squadBalance?.playerId).toBeNull();
    expect(squadBalance?.message).toBe("Only 1 midfielder(s); benchmark minimum is 3.");

    const economicRisk = items.find((item) => item.id.includes("economic-risk"));
    expect(economicRisk).toBeDefined();
    expect(economicRisk?.name).toBe("High Wage Star");
    expect(economicRisk?.playerId).toBe("p-101");
    expect(economicRisk?.message).toBe("High wage (150,000) relative to estimated value (500,000).");

    const assetRisk = items.find((item) => item.id.includes("asset-risk"));
    expect(assetRisk).toBeDefined();
    expect(assetRisk?.name).toBe("Aging Maestro");
    expect(assetRisk?.playerId).toBe("p-102");
    expect(assetRisk?.message).toBe("Senior age with high estimated value (3,000,000).");
  });

  it("unifies development alerts, youth academy signals, and diagnostics, capping at top 5", () => {
    const dashboard = {
      snapshotId: "snap-1",
      snapshotDate: "2026-09-01",
      club: { id: "club-1", clubId: 1, name: "FC Test", currency: "USD" },
      developmentSummary: {
        inferred: {
          highlightedPlayers: [
            { playerId: "dev-1", name: "Declining Defender", signal: "decline", severity: "high", confidence: "high" },
            { playerId: "dev-2", name: "Stagnating Wing", signal: "stagnation", severity: "low", confidence: "high" }
          ]
        }
      },
      youthPipelineSummary: {
        inferred: {
          highlightedPlayers: [
            { playerId: "yp-1", name: "Youth Risk", signal: "stagnation_risk", severity: "medium", confidence: "high" }
          ]
        }
      }
    } as unknown as ClubDashboard;

    const youthAcademy = {
      derived: {
        players: [
          {
            id: "ya-1",
            name: "Ready Academy Player",
            category: "ready_for_promotion",
            severity: "medium",
            signals: []
          }
        ]
      }
    } as unknown as RealYouthAcademyPlanning;

    const diagnostic = {
      findings: [
        createDiagnosticFinding({
          code: "training-potential.young-role-fit",
          category: "training-potential",
          severity: "low",
          parameters: { playerName: "Young Fit" },
          affectedPlayerIds: ["p-fit"]
        }),
        createDiagnosticFinding({
          code: "follow-up.incomplete-player-data",
          category: "follow-up",
          severity: "medium",
          parameters: { playerName: "Data Missing" },
          affectedPlayerIds: ["p-missing"]
        }),
        createDiagnosticFinding({
          code: "squad-balance.striker.deficit",
          category: "squad-balance",
          severity: "high",
          parameters: { role: "striker", currentCount: 0, minimum: 2 }
        })
      ]
    };

    const items = buildAttentionItems(dashboard, youthAcademy, diagnostic);

    // Total candidates was 7, capped at 5
    expect(items).toHaveLength(5);

    // First items must have high severity
    expect(items[0]?.severity).toBe("high");
    expect(items[1]?.severity).toBe("high");

    // All descriptions must be in English
    for (const item of items) {
      expect(item.message).not.toMatch(/plantilla|salario|requiere|jugador/i);
    }
  });
});

function createDiagnosticFinding(overrides: Partial<DiagnosticFinding>): DiagnosticFinding {
  return {
    code: overrides.code ?? "test.code",
    category: overrides.category ?? "test",
    severity: overrides.severity ?? "low",
    parameters: overrides.parameters,
    evidence: [],
    assumptions: [],
    confidence: "high",
    affectedPlayerIds: overrides.affectedPlayerIds ?? [],
    recommendations: []
  };
}

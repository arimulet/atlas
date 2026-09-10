import { describe, expect, it } from "vitest";

import type {
  DiagnosticFinding,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  TrainingPageData,
  YouthPipelinePlanning
} from "@atlas/web/app/types";
import { createDiagnosticsPageViewModel } from "./diagnostics-view-model";

describe("createDiagnosticsPageViewModel", () => {
  it("aggregates existing sources, preserves subjects, and orders by formal severity", () => {
    const training: TrainingPageData = {
      snapshotId: "snapshot-1",
      snapshotDate: "2026-08-14",
      configuration: null,
      players: [
        {
          id: "snapshot-player-1",
          playerId: 1,
          name: "Ana",
          age: 21,
          training: { position: 1, advanced: true }
        }
      ]
    };
    const development = createDevelopment();
    const trainingDiagnostic = {
      findings: [
        createTrainingFinding("squad-balance.deficit", "high"),
        createTrainingFinding("training-potential.young-role-fit", "low", "Ana")
      ]
    };
    const youthPipeline = createYouthPipeline();
    const youthAcademy = createYouthAcademy();

    const viewModel = createDiagnosticsPageViewModel({
      development,
      training,
      trainingDiagnostic,
      youthAcademy,
      youthPipeline
    });

    expect(viewModel.summary.total).toBe(5);
    expect(viewModel.summary.bySeverity).toEqual({ high: 2, medium: 1, low: 1, info: 1 });
    expect(viewModel.diagnostics.map((diagnostic) => diagnostic.severity)).toEqual([
      "high",
      "high",
      "medium",
      "low",
      "info"
    ]);
    expect(viewModel.diagnostics.map((diagnostic) => diagnostic.area)).toEqual([
      "Squad",
      "Player",
      "Youth",
      "Training",
      "Youth"
    ]);
    expect(viewModel.diagnostics[1]?.subject).toEqual({
      id: "player-1",
      type: "player",
      label: "Ana"
    });
    expect(viewModel.diagnostics[4]?.subject).toEqual({
      id: "youth-1",
      type: "youth",
      label: "Luz"
    });
  });

  it("does not create a diagnostic from positive development findings", () => {
    const development = createDevelopment();
    const player = development.derived.players[0]!;
    player.findings = [
      {
        type: "improvement",
        severity: "info",
        confidence: "high",
        title: "Improvement",
        description: "Observed improvement.",
        evidence: []
      }
    ];

    const viewModel = createDiagnosticsPageViewModel({
      development,
      training: null,
      trainingDiagnostic: null,
      youthAcademy: null,
      youthPipeline: null
    });

    expect(viewModel.diagnostics).toEqual([]);
  });
});

function createTrainingFinding(
  code: string,
  severity: DiagnosticFinding["severity"],
  playerName?: string
): DiagnosticFinding {
  return {
    code,
    category: code.split(".")[0] ?? "follow-up",
    severity,
    parameters: playerName ? { playerName } : undefined,
    evidence: [{ kind: "derived", code: "evidence", value: 1 }],
    assumptions: [],
    confidence: "high",
    affectedPlayerIds: [],
    recommendations: []
  };
}

function createDevelopment(): PlayerDevelopment {
  return {
    clubId: "club-1",
    snapshotCount: 2,
    snapshotDates: ["2026-08-01", "2026-08-14"],
    observed: {
      latestSnapshotId: "snapshot-1",
      latestSnapshotDate: "2026-08-14",
      players: [
        {
          playerId: "player-1",
          externalId: null,
          snapshotPlayerId: "snapshot-player-1",
          name: "Ana",
          age: 21,
          observedPosition: "midfielder",
          skills: {}
        }
      ]
    },
    manual: { trainingPriority: "passing" },
    derived: {
      players: [
        {
          playerId: "player-1",
          externalId: null,
          name: "Ana",
          age: 21,
          role: { label: "midfielder", source: "observed" },
          relevantSkills: [],
          skillChanges: [],
          recentEvolution: {
            direction: "down",
            improvedSkills: 0,
            declinedSkills: 1,
            stableSkills: 0,
            comparableSkills: 1,
            confidence: "high"
          },
          findings: [
            {
              type: "decline",
              severity: "high",
              confidence: "high",
              title: "Decline",
              description: "Observed decline.",
              evidence: [{ kind: "derived", label: "Skills", value: 1 }]
            }
          ],
          signals: [],
          warnings: []
        }
      ]
    },
    warnings: []
  };
}

function createYouthPipeline(): YouthPipelinePlanning {
  return {
    clubId: "club-1",
    snapshotId: "snapshot-1",
    snapshotDate: "2026-08-14",
    observed: {
      youthAgeThreshold: 23,
      players: [],
      coverage: {
        seniorPlayerCount: 1,
        youngSeniorPlayerCount: 1,
        playersWithStableIdentity: 1,
        playersWithCompleteSkills: 1
      }
    },
    manual: { academyInvestment: "balanced" },
    derived: {
      categoryCounts: {
        standout_prospect: 0,
        follow_up: 1,
        stagnation_risk: 0,
        insufficient_data: 0
      },
      players: [
        {
          playerId: "player-2",
          snapshotPlayerId: "snapshot-player-2",
          name: "Leo",
          age: 22,
          role: { label: "midfielder", source: "observed" },
          category: "follow_up",
          severity: "medium",
          confidence: "medium",
          rationale: "Follow-up",
          context: {
            window: { from: null, to: null, snapshotCount: 1 },
            dataCompleteness: { completeSkills: true, comparableSkills: 0 },
            valueAndWage: {
              wage: 10,
              wageCurrency: "USD",
              estimatedValue: 20,
              valueCurrency: "USD",
              valueDeltaPercent: null,
              wageDeltaPercent: null
            },
            limits: []
          },
          signals: [
            {
              code: "young_senior_follow_up",
              severity: "medium",
              confidence: "medium",
              message: "Young senior player requires follow-up.",
              evidence: [{ kind: "derived", label: "Comparable skills", value: 0 }]
            }
          ],
          warnings: []
        }
      ]
    },
    warnings: []
  };
}

function createYouthAcademy(): RealYouthAcademyPlanning {
  return {
    clubId: "club-1",
    snapshotId: "snapshot-1",
    snapshotDate: "2026-08-14",
    observed: {
      players: [],
      coverage: { totalYouthCount: 1, youthsWithWeeksRemaining: 1, youthsWithSkill: 1 },
      source: "snapshot.juniors"
    },
    manual: { academyInvestment: "balanced" },
    derived: {
      categoryCounts: {
        standout_prospect: 0,
        ready_for_promotion: 1,
        follow_up: 0,
        stagnation_risk: 0,
        insufficient_data: 0
      },
      players: [
        {
          id: "youth-1",
          externalId: null,
          name: "Luz",
          age: 17,
          initialLevel: 5,
          initialWeeks: 14,
          weeksInAcademy: 12,
          weeksRemaining: 2,
          projectedPromotionAge: 17,
          skill: 7,
          skillChange: null,
          levelPops: 2,
          talent: 6,
          expectedLevel: 7,
          formation: null, observations: "",
          status: "ready_for_promotion",
          category: "ready_for_promotion",
          severity: "info",
          confidence: "high",
          rationale: "Ready",
          signals: [
            {
              code: "youth_ready_for_promotion",
              severity: "info",
              confidence: "high",
              message: "Ready for promotion.",
              evidence: [{ kind: "observed", label: "Weeks remaining", value: 2 }]
            }
          ] as import("@atlas/web/app/types").RealYouthAcademySignal[],
          warnings: [] as import("@atlas/web/app/types").RealYouthAcademyWarning[],
          history: [] as import("@atlas/web/app/types").YouthSkillHistoryEntry[]
        }
      ]
    },
    warnings: []
  };
}


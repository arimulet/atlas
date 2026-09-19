import { describe, expect, it } from "vitest";
import type {
  PlayerDevelopmentPlan,
  PlayerDevelopmentProjection,
  PlayerTrainingPath
} from "@atlas/domain";
import type { PlayerDetailViewModel } from "@/app/view-models/player-detail-view-model";
import { createDevelopmentPlanViewModel } from "../development-plan-view-model";

function createPlayer(): PlayerDetailViewModel {
  return {
    player: { id: "7", name: "Test Player", age: 18, gameValue: null, gameValueChange: null },
    developmentPlayer: {
      playerId: 7,
      age: 18,
      observedPosition: "defender",
      skills: { defender: 10, pace: 9, technique: 8, playmaker: 6 }
    },
    skills: [],
    training: {
      playerId: "7",
      playerName: "Test Player",
      trainingPosition: 1,
      age: 18,
      value: null,
      valueChange: null,
      trainingType: "defending",
      trainingKind: "advanced",
      intensity: 100,
      skillChanges: [],
      progress: null,
      talent: 8,
      nextSkillUp: null,
      etaWeeks: null,
      status: null,
      position: "DEF",
      trainedSkill: "Defensa"
    },
    talent: { estimated: 8, confidence: "high", observations: 3 },
    projection: { current: { skill: "Defensa", level: 10, progress: null } },
    diagnostics: [],
    trainingHistory: [],
    developmentPlan: {
      suggestion: { profile: "defender", confidence: "high", reasons: [] },
      target: {
        playerId: 7,
        profile: "defender",
        source: "automatic",
        targetSkills: [{ skill: "defender", targetLevel: 11, priority: "primary", reasons: [] }]
      },
      idealTarget: {
        playerId: 7,
        profile: "defender",
        source: "automatic",
        targetSkills: [{ skill: "defender", targetLevel: 11, priority: "primary", reasons: [] }]
      },
      gap: {
        playerId: 7,
        profile: "defender",
        skills: [
          {
            skill: "defender",
            currentLevel: 10,
            targetLevel: 11,
            levelsRemaining: 1,
            priority: "primary",
            completed: false
          }
        ],
        totalGap: 1,
        progress: 0.9
      }
    } satisfies PlayerDevelopmentPlan,
    trainingPath: {
      playerId: 7,
      profile: "defender",
      steps: [
        {
          order: 1,
          skill: "defender",
          fromLevel: 10,
          toLevel: 11,
          priority: "primary",
          estimatedTrainingPoints: 1000,
          developmentValue: 1,
          reason: []
        }
      ],
      milestones: [],
      totals: { skillUps: 1, estimatedTrainingPoints: 1000 },
      completed: false,
      confidence: "high"
    } satisfies PlayerTrainingPath,
    developmentProjection: {
      playerId: 7,
      profile: "defender",
      generatedAtGameWeek: 1200,
      generatedAtDate: new Date("2026-08-20T00:00:00.000Z"),
      steps: [
        {
          order: 1,
          skill: "defender",
          fromLevel: 10,
          toLevel: 11,
          estimatedTrainingPoints: 1000,
          estimatedWeeks: 9,
          cumulativeWeeks: 9,
          estimatedGameWeek: 1209,
          estimatedDate: new Date("2026-10-22T00:00:00.000Z"),
          estimatedAge: 18,
          confidence: "high"
        }
      ],
      milestones: [],
      completion: {
        estimatedWeeks: 9,
        estimatedGameWeek: 1209,
        estimatedDate: new Date("2026-10-22T00:00:00.000Z"),
        estimatedAge: 18
      },
      confidence: "high",
      warnings: [],
      assumptions: {
        trainingKind: "advanced",
        expectedIntensity: 100,
        assumeContinuousTraining: true
      },
      projectionStatus: "projected"
    } satisfies PlayerDevelopmentProjection
  };
}

function createTraining(): NonNullable<
  Parameters<typeof createDevelopmentPlanViewModel>[0]["training"]
> {
  return {
    snapshotId: "snapshot-1",
    snapshotDate: "2026-08-20T00:00:00.000Z",
    configuration: { GK: 0, DEF: 0, MID: 0, ATT: 0 },
    players: [
      {
        id: "7",
        playerId: 7,
        name: "Test Player",
        age: 18,
        training: { position: 1, advanced: true },
        latestReport: {
          playerId: 7,
          gameWeek: 1200,
          seasonWeek: 20,
          date: "2026-08-20T00:00:00.000Z",
          type: "defending",
          kind: "advanced",
          intensity: 100,
          age: 18,
          skills: { defending: 10 },
          skillsChange: {},
          skillChanges: []
        },
        talentEstimate: {
          value: 8,
          confidence: "high",
          evidenceCount: 3,
          evidences: []
        }
      }
    ],
    history: []
  };
}

describe("createDevelopmentPlanViewModel", () => {
  it("maps the automatic target, progress, next step and assumptions", () => {
    const player = createPlayer();
    const training = createTraining();

    const plan = createDevelopmentPlanViewModel({ player, training });

    expect(plan).not.toBeNull();
    expect(plan?.profile.source).toBe("automatic");
  });



  it("produces deterministic path rows and projected milestones", () => {
    const input = { player: createPlayer(), training: createTraining() };

    const first = createDevelopmentPlanViewModel(input);
    const second = createDevelopmentPlanViewModel(input);

    expect(first?.path).toEqual(second?.path);
    expect(first?.milestones).toEqual(second?.milestones);
    expect(first?.path.every((step) => step.order > 0)).toBe(true);
  });

  it("does not mark a plan complete while it still has pending skill-ups", () => {
    const player = createPlayer();
    player.trainingPath = { ...player.trainingPath!, completed: true };

    const plan = createDevelopmentPlanViewModel({ player, training: createTraining() });

    expect(plan?.progress.remainingLevels).toBeGreaterThan(0);
    expect(plan?.completed).toBe(false);
  });

  it("keeps projected age unchanged when step stays within the same Sokker season even if latest training report is from previous season", () => {
    const player = createPlayer();
    player.player.age = 19;
    const training = createTraining();

    // Snapshot gameWeek is 1205 (Season 78 Week 8)
    if (player.developmentProjection) {
      player.developmentProjection.generatedAtGameWeek = 1205;
      player.developmentProjection.steps = [
        {
          order: 1,
          skill: "defender",
          fromLevel: 10,
          toLevel: 11,
          estimatedTrainingPoints: 1000,
          estimatedWeeks: 4,
          cumulativeWeeks: 4,
          estimatedGameWeek: 1209, // Season 78 Week 12 (same season -> still 19 yo)
          estimatedDate: new Date("2026-09-20T00:00:00.000Z"),
          estimatedAge: 19.3,
          confidence: "high"
        }
      ];
    }

    // Training history's latest report is from Season 77 Week 13 (gameWeek 1200) because Week 1 training hasn't run yet
    const latestReport = training.players[0]?.latestReport;
    if (latestReport) {
      latestReport.gameWeek = 1200;
    }

    const plan = createDevelopmentPlanViewModel({ player, training });

    // Step ending at GameWeek 1209 (Season 78 W12) relative to snapshot GameWeek 1205 (Season 78 W8) is still 19 yo
    expect(plan?.path[0]?.estimatedAge).toBe(19);
  });
});


import { describe, expect, it } from "vitest";
import type { PlayerDetailViewModel } from "../../../view-models/player-detail-view-model";
import {
  createDevelopmentPlanViewModel,
  targetDefaultsForProfile
} from "../development-plan-view-model";

function createPlayer(): PlayerDetailViewModel {
  return {
    player: { id: "7", name: "Test Player", age: 18 },
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
    recentSkillUps: [],
    trainingHistory: []
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

    const plan = createDevelopmentPlanViewModel({ player, training, manualOverride: null });

    expect(plan).not.toBeNull();
    expect(plan?.profile.source).toBe("automatic");
    expect(plan?.progress.remainingLevels).toBeGreaterThan(0);
    expect(plan?.nextStep?.order).toBe(1);
    expect(plan?.assumptions).toEqual({
      trainingKind: "advanced",
      expectedIntensity: 100,
      assumeContinuousTraining: true
    });
  });

  it("keeps a manual profile and exposes a suggested-profile conflict", () => {
    const plan = createDevelopmentPlanViewModel({
      player: createPlayer(),
      training: createTraining(),
      manualOverride: {
        profile: "forward",
        targetLevels: { striker: 12, pace: 11, technique: 10, passing: 7 }
      }
    });

    expect(plan?.profile.source).toBe("manual");
    expect(plan?.profile.current).toBe("forward");
    expect(plan?.profile.hasConflict).toBe(true);
    expect(plan?.targets.map((target) => target.skill)).toEqual([
      "striker",
      "pace",
      "technique",
      "passing"
    ]);
  });

  it("derives profile editor defaults from the domain catalog", () => {
    const defaults = targetDefaultsForProfile("central_defender", { defender: 13, pace: 8 });

    expect(defaults).toMatchObject({ defender: 13, pace: 10, technique: 9, playmaker: 7 });
  });

  it("produces deterministic path rows and projected milestones", () => {
    const input = { player: createPlayer(), training: createTraining(), manualOverride: null };

    const first = createDevelopmentPlanViewModel(input);
    const second = createDevelopmentPlanViewModel(input);

    expect(first?.path).toEqual(second?.path);
    expect(first?.milestones).toEqual(second?.milestones);
    expect(first?.path.every((step) => step.order > 0)).toBe(true);
  });
});

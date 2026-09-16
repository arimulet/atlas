import { describe, it } from "vitest";
import {
  PlayerDevelopmentPlanner,
  generatePlayerTrainingPath,
  projectDevelopment,
  projectPlayerMarketValue,
  calibratePlayerMarketValue
} from "@atlas/domain";

describe("Marcelo Cicint Test", () => {
  it("inspects Cicint development plan and market projection", () => {
    const cicintPlayer = {
      playerId: 39811507,
      age: 21,
      skills: {
        stamina: 7,
        keeper: 1,
        pace: 14,
        defender: 15,
        playmaker: 7,
        passing: 7,
        technique: 8,
        striker: 4
      }
    };

    console.log("=== MARCELO CICINT ANALYSIS ===");
    const planner = new PlayerDevelopmentPlanner();
    const plan = planner.createPlan(cicintPlayer);

    console.log("Profile:", plan.target.profile);
    console.log("Gap total:", plan.gap.totalGap);

    const path = generatePlayerTrainingPath({
      player: cicintPlayer,
      target: plan.target
    });

    console.log("Path steps count:", path.steps.length);
    for (const step of path.steps) {
      console.log("Path Step:", step.order, step.skill, step.fromLevel, "->", step.toLevel);
    }

    const projection = projectDevelopment({
      player: cicintPlayer,
      target: plan.target,
      path,
      currentGameWeek: 1209,
      currentDate: new Date("2026-09-12"),
      expectedWeeklyTrainingPoints: 35.2
    });

    console.log("Projection steps count:", projection.steps.length);
    for (const s of projection.steps) {
      console.log("Projection Step:", s.order, s.skill, s.fromLevel, "->", s.toLevel, s.estimatedWeeks, "w");
    }

    const currentMarketValue = calibratePlayerMarketValue(
      {
        player: {
          playerId: cicintPlayer.playerId,
          age: cicintPlayer.age,
          skills: cicintPlayer.skills
        },
        developmentProfile: plan.target.profile
      },
      []
    );

    console.log("Current Market Value:", currentMarketValue.calibratedValue);

    const marketProjection = projectPlayerMarketValue({
      player: {
        playerId: cicintPlayer.playerId,
        age: cicintPlayer.age,
        skills: cicintPlayer.skills,
        profile: plan.target.profile
      },
      developmentPlan: plan,
      path,
      projection,
      currentMarketValue,
      transfers: []
    });

    console.log("Market Projection points count:", marketProjection.points.length);
    for (const pt of marketProjection.points) {
      console.log("Point Step", pt.step, "Value:", pt.marketValue?.expected, "GainFromCurrent:", pt.valueGainFromCurrent);
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  assessYouthProspect,
  recommendYouthDecision,
  type YouthDevelopmentOpportunity,
  type YouthProspectAssessment
} from "@atlas/domain";
import type { YouthDecisionCandidate, YouthDecisionPlanning } from "@atlas/application";
import {
  createYouthDecisionViewModels,
  createYouthSummaryViewModel,
  filterYouthDecisionViewModels,
  mapYouthDecisionReason,
  mapYouthDecisionRisk
} from "./youth-decision-view-model";

describe("youth decision presentation model", () => {
  it("translates domain reasons and risks into readable messages", () => {
    expect(
      mapYouthDecisionReason({ type: "fills_future_squad_need", profile: "defender" })
    ).toEqual({
      title: "Future squad need",
      description: "Covers a future Defender need."
    });
    expect(mapYouthDecisionRisk({ type: "advanced_slot_unlikely" })).toEqual({
      title: "Advanced slot may be unavailable",
      description: "Formation training may be the initial development route."
    });
  });

  it("keeps prospect quality and club fit as separate presentation labels", () => {
    const planning = createPlanning([
      createCandidate(1, 0.86, { clubFitScore: 0.2, opportunity: "poor" })
    ]);

    const [model] = createYouthDecisionViewModels(planning, "USD");

    expect(model).toMatchObject({
      decision: "keep",
      prospectQualityLabel: "Very High",
      clubFitLabel: "Poor",
      profileLabel: "Defender"
    });
  });

  it("sorts by priority and action, then supports decision and priority filters", () => {
    const planning = createPlanning([
      createCandidate(2, 0.7, { clubFitScore: 0.7, opportunity: "good" }),
      createCandidate(1, 0.85, { clubFitScore: 0.85, opportunity: "excellent" })
    ]);
    const models = createYouthDecisionViewModels(planning, null);

    expect(models.map((model) => model.playerId)).toEqual(["1", "2"]);
    expect(
      filterYouthDecisionViewModels(models, "high").every((model) => model.priority === "high")
    ).toBe(true);
    expect(
      filterYouthDecisionViewModels(models, "train").every((model) => model.decision === "train")
    ).toBe(true);
  });

  it("summarizes academy and promoted decision candidates compactly", () => {
    const planning = createPlanning([
      createCandidate(1, 0.85, { clubFitScore: 0.85, opportunity: "excellent" })
    ]);

    const summary = createYouthSummaryViewModel(planning, 8);

    expect(summary).toMatchObject({
      academyPlayers: 8,
      decisionCandidates: 1,
      highPriorityDecisions: 1
    });
    expect(summary.counts.train).toBe(1);
  });
});

function createPlanning(candidates: YouthDecisionCandidate[]): YouthDecisionPlanning {
  const recommendations = candidates.map((candidate) => candidate.recommendation);
  return {
    clubId: "club-1",
    candidates,
    summary: {
      recommendations,
      counts: {
        train: recommendations.filter((item) => item.decision === "train").length,
        keep: recommendations.filter((item) => item.decision === "keep").length,
        sell: recommendations.filter((item) => item.decision === "sell").length,
        release: recommendations.filter((item) => item.decision === "release").length,
        hold: recommendations.filter((item) => item.decision === "hold").length,
        unknown: recommendations.filter((item) => item.decision === "unknown").length
      },
      highPriorityDecisions: recommendations.filter((item) => item.priority === "high").length,
      advancedCandidates: 0
    },
    advancedTraining: null
  };
}

function createCandidate(
  playerId: number,
  prospectScore: number,
  opportunityOverrides: Partial<YouthDevelopmentOpportunity>
): YouthDecisionCandidate {
  const player = {
    playerId,
    age: 17,
    formation: "DEF" as const,
    skills: { defender: 11, pace: 10, technique: 9, passing: 7 }
  };
  const prospect: YouthProspectAssessment = {
    ...assessYouthProspect({ player }),
    prospectScore,
    confidence: "high",
    reasons: [{ type: "training_evidence", observationCount: 3 }]
  };
  const opportunity: YouthDevelopmentOpportunity = {
    playerId,
    profile: "defender",
    squadNeedScore: 0.7,
    successionFitScore: 0.7,
    developmentOpportunityScore: 0.7,
    resourceCompetitionScore: 0.1,
    clubFitScore: 0.8,
    opportunity: "excellent",
    confidence: "high",
    reasons: [],
    succession: null,
    advancedTraining: null,
    reprofileOpportunity: null,
    developmentCapacity: null,
    ...opportunityOverrides
  };
  const recommendation = recommendYouthDecision({ player, prospect, opportunity });

  return {
    playerId,
    playerName: `Player ${playerId}`,
    age: 17,
    role: "prospect",
    formation: "DEF",
    initialProfile: "defender",
    prospect,
    opportunity,
    recommendation,
    developmentPlan: null,
    trainingPath: null,
    developmentProjection: null,
    marketValue: null,
    marketProjection: null
  };
}

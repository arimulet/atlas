import { describe, expect, it } from "vitest";
import { TrainingRecommendationIndicator } from "../TrainingPlayerTables";

describe("TrainingRecommendationIndicator", () => {
  it("renders null if training kind is not advanced", () => {
    // Formation trainees should not show recommended action
    expect(
      TrainingRecommendationIndicator({
        kind: "formation",
        recommendation: "Switch → Technique"
      })
    ).toBeNull();

    expect(
      TrainingRecommendationIndicator({
        kind: "missing",
        recommendation: "Switch → Technique"
      })
    ).toBeNull();

    expect(
      TrainingRecommendationIndicator({
        kind: null,
        recommendation: "Switch → Technique"
      })
    ).toBeNull();

    expect(
      TrainingRecommendationIndicator({
        kind: undefined,
        recommendation: "Switch → Technique"
      })
    ).toBeNull();
  });

  it("renders null when kind is advanced but recommendation is not a switch action", () => {
    expect(
      TrainingRecommendationIndicator({
        kind: "advanced",
        recommendation: "Continue"
      })
    ).toBeNull();

    expect(
      TrainingRecommendationIndicator({
        kind: "advanced",
        recommendation: "Hold"
      })
    ).toBeNull();

    expect(
      TrainingRecommendationIndicator({
        kind: "advanced",
        recommendation: undefined
      })
    ).toBeNull();

    expect(
      TrainingRecommendationIndicator({
        kind: "advanced",
        recommendation: ""
      })
    ).toBeNull();
  });

  it("renders recommendation indicator when player is in advanced training and recommendation is a switch", () => {
    const element = TrainingRecommendationIndicator({
      kind: "advanced",
      recommendation: "Switch → Passing"
    });

    expect(element).not.toBeNull();
    expect(element?.type).toBe("span");
    expect(element?.props.className).toBe("atlas-training-recommendation-indicator");
    expect(element?.props["aria-label"]).toBe("Recommended action: Switch → Passing");
    expect(element?.props.title).toBe("Recommended action: Switch → Passing");
  });
});

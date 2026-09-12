import { describe, expect, it } from "vitest";
import type { TrainingReport } from "@atlas/web/app/types";
import { TrainingDetails } from "../TrainingDetails";
import { TRAINABLE_SKILL_DEFINITIONS } from "@/app/view-models/player-skills";

describe("TrainingDetails", () => {
  const mockHistory: TrainingReport[] = [
    {
      id: "report-1",
      gameWeek: 105,
      season: 25,
      seasonWeek: 5,
      age: 21,
      type: "pace",
      kind: "advanced",
      intensity: 100,
      skills: {
        form: 14,
        stamina: 9,
        pace: 11,
        technique: 8,
        passing: 6,
        keeper: 2,
        defending: 5,
        playmaking: 7,
        scoring: 4
      },
      skillChanges: []
    }
  ];

  it("does not include the form (FOR) column in training history headers", () => {
    const element = TrainingDetails({
      history: mockHistory,
      player: {
        etaWeeks: 2,
        nextSkillUp: 12,
        progress: 45,
        trainingType: "pace"
      }
    });

    expect(element).not.toBeNull();

    const table = element?.props.children;
    const thead = table.props.children[1];
    const headerRow = thead.props.children;
    const [ageTh, skillThs] = headerRow.props.children;

    expect(ageTh.props.children).toBe("Age");

    const headerLabels = skillThs.map((th: { props: { children: string } }) => th.props.children);

    expect(headerLabels).not.toContain("FOR");
    expect(headerLabels).toEqual(TRAINABLE_SKILL_DEFINITIONS.map((s) => s.shortLabel));
    expect(headerLabels).toEqual(["STA", "PAC", "TEC", "PAS", "GK", "DEF", "PM", "SCO"]);
  });

  it("excludes form from the colgroup", () => {
    const element = TrainingDetails({
      history: mockHistory,
      player: {
        etaWeeks: 2,
        nextSkillUp: 12,
        progress: 45,
        trainingType: "pace"
      }
    });

    const table = element?.props.children;
    const colgroup = table.props.children[0];
    const [seasonCol, skillCols] = colgroup.props.children;

    expect(seasonCol.props.className).toBe("is-season");
    expect(skillCols).toHaveLength(8);
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectionPanel } from "../ProjectionPanel";
import type { PlayerDetailViewModel } from "@/app/view-models/player-detail-view-model";

describe("ProjectionPanel - Skill format", () => {
  it("renders Current, Next skill-up, and horizon level in '{skillName} [{skillNumber}]' format without change indicators", () => {
    const projection: PlayerDetailViewModel["projection"] = {
      current: {
        skill: "Striker",
        level: 8,
        progress: 60
      },
      nextSkillUp: {
        targetLevel: 9,
        estimatedWeeks: 3
      },
      horizon: {
        weeks: 12,
        projectedLevel: 10
      }
    };

    const html = renderToStaticMarkup(
      <ProjectionPanel
        projection={projection}
        talent={{ estimated: 4.5, confidence: "high", observations: 4 }}
        training={{ status: null } as PlayerDetailViewModel["training"]}
      />
    );

    // Current: solid [8]
    expect(html).toContain(">solid [8]</strong>");

    // Next skill-up: very good [9]
    expect(html).toContain(">very good [9]</strong>");

    // Horizon (In 12 weeks): excellent [10]
    expect(html).toContain(">excellent [10]</dd>");

    // No change indicator rendered inside Potential Projection
    expect(html).not.toContain("atlas-player-detail__skill-change");
  });
});

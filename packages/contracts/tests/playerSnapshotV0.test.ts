import { describe, expect, it } from "vitest";
import validSnapshot from "@atlas/test-fixtures/player-snapshot/valid.json" with { type: "json" };
import invalidSnapshot from "@atlas/test-fixtures/player-snapshot/invalid.json" with { type: "json" };
import acceptedWithWarningsSnapshot from "@atlas/test-fixtures/player-snapshot/accepted-with-warnings.json" with {
  type: "json"
};
import { validatePlayerSnapshotV0 } from "../src/index.js";

describe("atlas.player-snapshot.v0", () => {
  it("accepts valid JSON", () => {
    const result = validatePlayerSnapshotV0(validSnapshot);

    expect(result.status).toBe("accepted");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("rejects invalid JSON", () => {
    const result = validatePlayerSnapshotV0(invalidSnapshot);

    expect(result.status).toBe("rejected");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.map((error) => error.path)).toContain("players.0.name");
    expect(result.errors.map((error) => error.path)).toContain("players.0.skills");
  });

  it("accepts JSON with warnings", () => {
    const result = validatePlayerSnapshotV0(acceptedWithWarningsSnapshot);

    expect(result.status).toBe("accepted-with-warnings");
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.map((warning) => warning.path)).toContain("players.0.externalId");
    expect(result.warnings.map((warning) => warning.path)).toContain("players.0.skills.technique");
  });
});

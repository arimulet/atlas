import { describe, expect, it } from "vitest";
import validSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/valid.json" with { type: "json" };
import invalidSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/invalid.json" with { type: "json" };
import acceptedWithWarningsSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/accepted-with-warnings.json" with {
  type: "json"
};
import {
  validateYouthAcademySnapshotV0,
  YOUTH_ACADEMY_SNAPSHOT_SCHEMA_VERSION
} from "../src/index.js";

describe("validateYouthAcademySnapshotV0", () => {
  it("accepts a valid youth academy snapshot without warnings", () => {
    const result = validateYouthAcademySnapshotV0(validSnapshot);

    expect(result.status).toBe("accepted");
    expect(result.data?.schemaVersion).toBe(YOUTH_ACADEMY_SNAPSHOT_SCHEMA_VERSION);
    expect(result.data?.academy.players).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("rejects a youth snapshot without the required numeric skill", () => {
    const payload = structuredClone(validSnapshot) as { academy: { players: Array<Record<string, unknown>> } };
    delete payload.academy.players[0]!.skill;

    const result = validateYouthAcademySnapshotV0(payload);

    expect(result.status).toBe("rejected");
    expect(result.errors.map((error) => error.path)).toContain("academy.players.0.skill");
    expect(result.warnings.map((warning) => warning.path)).toContain("academy.players.0.skill");
  });
  it("rejects an invalid youth academy snapshot with errors", () => {
    const result = validateYouthAcademySnapshotV0(invalidSnapshot);

    expect(result.status).toBe("rejected");
    expect(result.data).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.map((error) => error.path)).toContain("academy.players.0.name");
  });

  it("accepts a snapshot with non-blocking warnings", () => {
    const result = validateYouthAcademySnapshotV0(acceptedWithWarningsSnapshot);

    expect(result.status).toBe("accepted-with-warnings");
    expect(result.data).not.toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.map((warning) => warning.path)).toContain("academy.weeklyInvestment.currency");
  });
});

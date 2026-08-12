import { describe, expect, it } from "vitest";
import { sokkerVarsXmlSchema } from "@atlas/contracts";

describe("Sokker vars XML contract", () => {
  it("normalizes numeric values from XML strings", () => {
    expect(sokkerVarsXmlSchema.parse({ vars: { week: "1204", day: "3" } })).toEqual({
      vars: { week: 1204, day: 3 }
    });
  });
});

import { describe, expect, it } from "vitest";
import { normalizePositionCode, PositionBadge } from "../index";

describe("PositionBadge", () => {
  describe("normalizePositionCode", () => {
    it("normalizes standard codes and numbers", () => {
      expect(normalizePositionCode("GK")).toBe("GK");
      expect(normalizePositionCode("def")).toBe("DEF");
      expect(normalizePositionCode("MID")).toBe("MID");
      expect(normalizePositionCode("att")).toBe("ATT");

      expect(normalizePositionCode(0)).toBe("GK");
      expect(normalizePositionCode(1)).toBe("DEF");
      expect(normalizePositionCode(2)).toBe("MID");
      expect(normalizePositionCode(3)).toBe("ATT");
    });

    it("normalizes full role names", () => {
      expect(normalizePositionCode("goalkeeper")).toBe("GK");
      expect(normalizePositionCode("defender")).toBe("DEF");
      expect(normalizePositionCode("wing_defender")).toBe("DEF");
      expect(normalizePositionCode("midfielder")).toBe("MID");
      expect(normalizePositionCode("winger")).toBe("MID");
      expect(normalizePositionCode("forward")).toBe("ATT");
      expect(normalizePositionCode("striker")).toBe("ATT");
    });

    it("returns null for invalid or empty positions", () => {
      expect(normalizePositionCode(null)).toBeNull();
      expect(normalizePositionCode(undefined)).toBeNull();
      expect(normalizePositionCode("unknown")).toBeNull();
      expect(normalizePositionCode("release")).toBeNull();
    });
  });

  describe("PositionBadge rendering", () => {
    it("renders nothing when position is null or undefined", () => {
      expect(PositionBadge({ position: null })).toBeNull();
      expect(PositionBadge({ position: undefined })).toBeNull();
    });

    it("returns a JSX element with proper classes for known positions", () => {
      const gk = PositionBadge({ position: "GK" });
      expect(gk).toBeDefined();
      expect(gk?.props.className).toContain("is-gk");
      expect(gk?.props.children).toBe("GK");

      const def = PositionBadge({ position: 1 });
      expect(def).toBeDefined();
      expect(def?.props.className).toContain("is-def");
      expect(def?.props.children).toBe("DEF");

      const mid = PositionBadge({ position: "midfielder" });
      expect(mid).toBeDefined();
      expect(mid?.props.className).toContain("is-mid");
      expect(mid?.props.children).toBe("MID");

      const att = PositionBadge({ position: "ATT", size: "md" });
      expect(att).toBeDefined();
      expect(att?.props.className).toContain("is-att");
      expect(att?.props.className).toContain("atlas-position-badge--md");
      expect(att?.props.children).toBe("ATT");
    });

    it("handles RELEASE and UNKNOWN positions", () => {
      const release = PositionBadge({ position: "RELEASE" });
      expect(release?.props.className).toContain("is-release");
      expect(release?.props.children).toBe("RELEASE");

      const unknown = PositionBadge({ position: "UNKNOWN" });
      expect(unknown?.props.className).toContain("is-unknown");
      expect(unknown?.props.children).toBe("UNKNOWN");
    });
  });
});

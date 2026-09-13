import { describe, expect, it } from "vitest";

import { findCountryCode } from "../index";

describe("findCountryCode", () => {
  it("resolves country names from every registered language", () => {
    expect(findCountryCode("Argentina")).toBe("AR");
    expect(findCountryCode("Deutschland")).toBe("DE");
    expect(findCountryCode("Hellas")).toBe("GR");
    expect(findCountryCode("Polska")).toBe("PL");
  });

  it("accepts alpha-2 codes regardless of their casing", () => {
    expect(findCountryCode("de")).toBe("DE");
  });

  it("resolves Sokker specific country names and endonyms", () => {
    expect(findCountryCode("Shqipëria")).toBe("AL");
    expect(findCountryCode("shqiperia")).toBe("AL");
    expect(findCountryCode("England")).toBe("GB-ENG");
    expect(findCountryCode("Scotland")).toBe("GB-SCT");
    expect(findCountryCode("Cymru")).toBe("GB-WLS");
    expect(findCountryCode("Nippon")).toBe("JP");
    expect(findCountryCode("Al Maghrib")).toBe("MA");
    expect(findCountryCode("al-Jazā’ir")).toBe("DZ");
    expect(findCountryCode("as-Saʻūdiyya")).toBe("SA");
    expect(findCountryCode("O‘zbekiston")).toBe("UZ");
    expect(findCountryCode("U.A.E.")).toBe("AE");
  });
});
